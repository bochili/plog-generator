import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'node:fs'
import express from 'express'

const { exec } = require('child_process')
import * as path from 'node:path'

import qs from 'qs'
import sharp from 'sharp'
import { createServer } from 'http'
import { readFile } from 'fs'
import { extname as _extname } from 'path'
import ExifReader from 'exifreader'

let serverPort = null
let setsPath = '/data/sets.json'
let picsPath = '/data/pics.json'
let picsDir = '/pics'
let thumbnailPicsDir = '/pics/thumbnails'
let staticPath = '/static/pics/'

import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(__dirname)

function loadJson(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(filePath), 'utf8', (err, data) => {
      if (err) {
        reject(err)
        return
      }
      try {
        const jsonData = JSON.parse(data)
        resolve(jsonData)
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
}

function generateUniqueId() {
  return Date.now() + Math.floor(Math.random() * 10000)
}

function generateThumbnail(inputPath, outputPath, width = 200, height = 200) {
  return new Promise((resolve, reject) => {
    sharp(inputPath)
      .resize(width, height)
      .toFile(outputPath, (err, info) => {
        if (err) {
          return reject(err)
        }
        resolve(info)
      })
  })
}

let mainWindow = null
const appDir = app.getPath('userData')
const expressApp = express()
let previewServer = null
let isPreviewRunning = false

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 850,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
function createFolder(folderPath) {
  try {
    fs.mkdirSync(folderPath, { recursive: true })
    console.log('Folder created:', folderPath)
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('Failed to create folder:', err)
    } else {
      console.log('Folder already exists:', folderPath)
    }
  }
}

function openFolder(folderPath) {
  const normalizedPath = path.normalize(folderPath)

  if (process.platform === 'win32') {
    exec(`start "" "${normalizedPath}"`)
  } else if (process.platform === 'darwin') {
    exec(`open "${normalizedPath}"`)
  } else if (process.platform === 'linux') {
    exec(`xdg-open "${normalizedPath}"`)
  }
}

const defaultConfig = {
  template: 'templates/pure',
  staticPath: path.join(appDir, 'static'),
  exportPath: ''
}
let currentConfig = {}

function getDirectoryObjectsSync(directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath, { withFileTypes: true })
    return files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => path.join(directoryPath, dirent.name))
  } catch (err) {
    console.error('读取目录时出错:', err)
    return []
  }
}

function createFile(filePath, fileContent) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fileContent)
    console.log(`File ${filePath} created successfully.`)
  } else {
    console.log(`${filePath} already exists.`)
  }
}

function readJSONFile(filePath, replace = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    console.error('读取或解析文件时出错:', err)
    return replace
  }
}

async function copyDirectory(src, dest) {
  console.log(`Copying directory from ${src} to ${dest}`)
  try {
    // 检查目标目录是否存在，如果不存在则创建
    await fs.promises.mkdir(dest, { recursive: true })
    // 读取源目录中的文件和目录
    const entries = await fs.promises.readdir(src, { withFileTypes: true })
    // 遍历每个文件和目录
    for (let entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        // 如果是目录，则递归复制
        await copyDirectory(srcPath, destPath)
      } else {
        // 如果是文件，则复制文件
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
    return true
  } catch (error) {
    return false
  }
}

const clearDirectory = async (dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath)
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dirPath, file)
        const stat = await fs.promises.stat(filePath)
        if (stat.isDirectory()) {
          await fs.promises.rmdir(filePath, { recursive: true })
        } else {
          await fs.promises.unlink(filePath)
        }
      })
    )
    console.log(`已清空目录: ${dirPath}`)
  } catch (err) {
    console.error('清空目录时出错:', err)
  }
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  // 初始化应用目录
  createFolder(path.join(appDir, 'templates'))
  createFolder(path.join(appDir, 'static/pics/thumbnails'))
  createFolder(path.join(appDir, 'static/data'))
  createFile(path.join(appDir, 'config.json'), JSON.stringify(defaultConfig))
  createFile(path.join(appDir, 'static/data/sets.json'), JSON.stringify({}))
  createFile(path.join(appDir, 'static/data/pics.json'), JSON.stringify({}))
  currentConfig = readJSONFile(path.join(appDir, 'config.json'), defaultConfig)
  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  createWindow()

  app.on('activate', function() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  ipcMain.on('open-folder', (event, folderType) => {
    if (folderType === 'templates') {
      openFolder(path.join(appDir, 'templates'))
    } else if (folderType === 'pics') {
      openFolder(path.join(currentConfig.staticPath, '/pics'))
    } else {
      openFolder(path.join(folderType))
    }
  })
  ipcMain.handle('save:config', (event, configContent) => {
    currentConfig = JSON.parse(configContent)
    try {
      fs.writeFileSync(path.join(appDir, 'config.json'), configContent)
      return true
    } catch (err) {
      console.error('保存配置文件时出错:', err)
      return false
    }
  })
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'] // 只允许选择目录
    })
    return result.filePaths // 返回选择的目录路径
  })
  ipcMain.handle('get:config', async () => {
    return currentConfig
  })
  ipcMain.handle('get:templates', async () => {
    return ['templates/pure', ...getDirectoryObjectsSync(path.join(appDir, 'templates'))]
  })
  ipcMain.handle('get:port', async () => {
    return serverPort
  })
  ipcMain.handle('generate', async (event, exportPath) => {
    await clearDirectory(path.join(exportPath))
    let res = await copyDirectory(
      path.join(
        currentConfig.template.startsWith('templates/')
          ? path
            .join(__dirname, `../../resources/${currentConfig.template}`)
            .replace('app.asar', 'app.asar.unpacked')
          : currentConfig.template
      ),
      path.join(exportPath)
    )
    if (!res) return false
    res = await copyDirectory(path.join(currentConfig.staticPath), path.join(exportPath, '/static'))
    return res
  })
  ipcMain.handle('start:preview', async (e, path) => {
    if (!path) return false
    try {
      expressApp.use(express.static(path))
      previewServer = await expressApp.listen(0)
      isPreviewRunning = true
      shell.openExternal(`http://localhost:${previewServer.address().port}`)
      return previewServer.address().port
    } catch (err) {
      console.log(err)
      return false
    }
  })
  ipcMain.handle('stop:preview', async () => {
    if (isPreviewRunning && previewServer) {
      await previewServer.close()
      isPreviewRunning = false
      previewServer = null
    }
    return true
  })
  ipcMain.handle('get:preview', async () => {
    return isPreviewRunning ? previewServer.address().port : 0
  })
  ipcMain.handle('zip', async (e, quality) => {
    console.log(quality)
    return await compressJPGFiles(path.join(currentConfig.staticPath + picsDir), quality)
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

function deleteRelatePicInSets(id) {
  loadJson(currentConfig.staticPath + setsPath).then((setsData) => {
    // 读取sets.json文件
    for (const set in setsData) {
      if (setsData[set].pics) {
        setsData[set].pics = setsData[set].pics.filter((pic) => pic !== id)
      }
    }
    fs.writeFile(currentConfig.staticPath + setsPath, JSON.stringify(setsData), (writeErr) => {
      if (writeErr) {
        console.error('保存sets.json文件时出错:', writeErr)
        return
      }
      console.log('相关图片已从sets中删除')
    })
  })
}

async function compressJPGFiles(directoryPath, quality) {
  let errorSum = 0
  try {
    // 读取目录内容
    const files = fs.readdirSync(directoryPath)
    const compressedDir = path.join(directoryPath, 'compressed')
    if (!fs.existsSync(compressedDir)) {
      fs.mkdirSync(compressedDir)
      console.log(`已创建目录: ${compressedDir}`)
    }
    // 过滤出 JPG 文件
    const jpgFiles = files.filter(
      (file) =>
        path.extname(file).toLowerCase() === '.jpg' || path.extname(file).toLowerCase() === '.jpeg'
    )
    // 对每个 JPG 文件进行压缩
    sharp.cache(false)
    for (const file of jpgFiles) {
      try {
        const filePath = path.join(directoryPath, file)
        const outputFilePath = path.join(directoryPath, 'compressed', file)
        await sharp(filePath).keepExif().jpeg({ quality: quality }).toFile(outputFilePath) // 将图像转换为 buffer 形式
        console.log(`Compressed image: ${file}, Saved to ${outputFilePath}`)
        fs.copyFileSync(outputFilePath, filePath)
        console.log(`Rewrote the origin file. ${filePath}`)
        fs.rmSync(outputFilePath)
        console.log(`Deleted the compressed file:${outputFilePath}`)
      } catch (e) {
        errorSum += 1
        console.log(`Error compressing image: ${file}, Error: ${e}`)
      }
    }
    fs.rmSync(path.join(directoryPath, 'compressed'), { recursive: true, force: true })
    console.log(`Compress over. ${errorSum} Image Compress Error.`)
    // 如果全部操作成功，返回 true
    return errorSum
  } catch (err) {
    return errorSum
  }
}

const listenServer = (port) => {
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${server.address().port}/`)
    serverPort = server.address().port
  })
}
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*') // 允许所有域名访问
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS') // 允许的 HTTP 方法
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type') // 允许的请求头
  if (req.method === 'GET' && req.url === '/api/gallery') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    loadJson(currentConfig.staticPath + picsPath).then((data) => {
      res.end(JSON.stringify(data))
    })
    return
  } else if (req.method === 'GET' && req.url === '/api/sets') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    loadJson(currentConfig.staticPath + setsPath).then((data) => {
      res.end(JSON.stringify(data))
    })
    return
  } else if (req.method === 'POST' && req.url === '/api/updateSet') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const data = qs.parse(body)
      loadJson(currentConfig.staticPath + setsPath).then((setsData) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          setsData[data['id']] = {
            name: data['name'],
            img: data['img'],
            date: data['date'],
            pics:
              data['pics'] !== null && typeof data['pics'] === 'object'
                ? Object.values(data['pics'])
                : data['pics'],
            address: data['address'],
            desc: data['desc'],
            show: data['show'],
            memo: data['memo']
          }
          fs.writeFile(
            currentConfig.staticPath + setsPath,
            JSON.stringify(setsData),
            (writeErr) => {
              if (writeErr) {
                res.end(JSON.stringify({ success: false, msg: writeErr.message }))
                return
              }
              res.end(JSON.stringify({ success: true, msg: '更新成功！' }))
            }
          )
        } catch (err) {
          res.end(JSON.stringify({ success: false, msg: err.message }))
          return
        }
      })
    })
    return
  } else if (req.method === 'POST' && req.url === '/api/updatePic') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const data = qs.parse(body)
      loadJson(currentConfig.staticPath + picsPath).then((picsData) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          picsData[data['id']] = {
            name: data['name'],
            filename: data['filename'],
            img: data['img'],
            date: data['date'],
            desc: data['desc'],
            tags: data['tags'],
            size: data['size'],
            address: data['address'],
            camera: data['camera'],
            lens: data['lens'],
            focal: data['focal'],
            fstop: data['fstop'],
            shutter: data['shutter'],
            iso: data['iso'],
            thumbnail: data['thumbnail'],
            edited: true
          }
          fs.writeFile(
            currentConfig.staticPath + picsPath,
            JSON.stringify(picsData),
            (writeErr) => {
              if (writeErr) {
                res.end(JSON.stringify({ success: false, msg: writeErr.message }))
                return
              }
              res.end(JSON.stringify({ success: true, msg: '更新成功！' }))
            }
          )
        } catch (err) {
          res.end(JSON.stringify({ success: false, msg: err.message }))
          return
        }
      })
    })
    return
  } else if (req.method === 'POST' && req.url === '/api/updatePicsUrl') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const data = qs.parse(body)
      loadJson(currentConfig.staticPath + picsPath).then(async (picsData) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          for (let key in data['data']) {
            if (data['isDelete'] === 'true') {
              fs.unlink(
                `${path.join(currentConfig.staticPath, picsData[key]['img'].replace('/static', '/'))}`,
                (err) => {
                  if (err) {
                    console.error('Error deleting file:', err)
                    return
                  }
                }
              )
            }
            picsData[key]['img'] = data['data'][key]
          }
          fs.writeFile(
            currentConfig.staticPath + picsPath,
            JSON.stringify(picsData),
            (writeErr) => {
              if (writeErr) {
                res.end(JSON.stringify({ success: false, msg: writeErr.message }))
                return
              }
              res.end(JSON.stringify({ success: true, msg: '更新成功！' }))
            }
          )
        } catch (err) {
          res.end(JSON.stringify({ success: false, msg: err.message }))
          return
        }
      })
    })
    return
  } else if (req.method === 'POST' && req.url === '/api/deleteSet') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const data = qs.parse(body)
      loadJson(currentConfig.staticPath + setsPath).then((setsData) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          delete setsData[data['id']]
          fs.writeFile(
            currentConfig.staticPath + setsPath,
            JSON.stringify(setsData),
            (writeErr) => {
              if (writeErr) {
                res.end(JSON.stringify({ success: false, msg: writeErr.message }))
                return
              }
              res.end(JSON.stringify({ success: true, msg: '删除成功！' }))
            }
          )
        } catch (err) {
          res.end(JSON.stringify({ success: false, msg: err.message }))
          return
        }
      })
    })
    return
  } else if (req.method === 'POST' && req.url === '/api/deletePic') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const data = qs.parse(body)
      loadJson(currentConfig.staticPath + picsPath).then((picsData) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          if (String(picsData[data['id']]['img']).startsWith(staticPath)) {
            // const filePath = `./public${picsData[data['id']]['img']}`
            // const thumbnailPath = `./public${picsData[data['id']]['thumbnail']}`
            const filePath = path.join(
              currentConfig.staticPath,
              picsData[data['id']]['img'].replace('/static', '/')
            )
            const thumbnailPath = path.join(
              currentConfig.staticPath,
              picsData[data['id']]['thumbnail'].replace('/static', '/')
            )
            fs.unlink(filePath, (err) => {
              if (err) {
                console.error('Error deleting file:', err)
                return
              }
              console.log(`${filePath} deleted successfully`)
            })
            fs.unlink(thumbnailPath, (err) => {
              if (err) {
                console.error('Error deleting file:', err)
                return
              }
              console.log(`${thumbnailPath} deleted successfully`)
            })
          }
          deleteRelatePicInSets(data['id'])
          delete picsData[data['id']]
          fs.writeFile(
            currentConfig.staticPath + picsPath,
            JSON.stringify(picsData),
            (writeErr) => {
              if (writeErr) {
                res.end(JSON.stringify({ success: false, msg: writeErr.message }))
                return
              }
              res.end(JSON.stringify({ success: true, msg: '删除成功！' }))
            }
          )
        } catch (err) {
          res.end(JSON.stringify({ success: false, msg: err.message }))
          return
        }
      })
    })
    return
  } else if (req.method === 'POST' && req.url === '/api/newSet') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      const data = qs.parse(body)
      loadJson(currentConfig.staticPath + setsPath).then((setsData) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          setsData[`${generateUniqueId()}`] = {
            ...data,
            pics:
              data['pics'] !== null && typeof data['pics'] === 'object'
                ? Object.values(data['pics'])
                : data['pics']
          }
          fs.writeFile(
            currentConfig.staticPath + setsPath,
            JSON.stringify(setsData),
            (writeErr) => {
              if (writeErr) {
                res.end(JSON.stringify({ success: false, error: writeErr.message }))
                return
              }
              res.end(JSON.stringify({ success: true }))
            }
          )
        } catch (err) {
          res.end(JSON.stringify({ success: false, error: err.message }))
          return
        }
      })
    })
    return
  } else if (req.method === 'GET' && req.url === '/api/scanPics') {
    loadJson(currentConfig.staticPath + picsPath).then((picsData) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      try {
        fs.readdir(currentConfig.staticPath + picsDir, async (err, files) => {
          if (err) {
            return console.error('Unable to scan directory: ' + err)
          }
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']
          const extraFiles = files.filter((file) => {
            const ext = path.extname(file).toLowerCase()
            if (!imageExtensions.includes(ext)) return false
            return !Object.values(picsData).some((item) => item?.img === staticPath + file)
          })
          // const extraFiles = files.filter(file => !picsData.hasOwnProperty(file));
          // 输出结果
          if (extraFiles.length > 0) {
            for (let file of extraFiles) {
              const tags = await ExifReader.load(currentConfig.staticPath + picsDir + '/' + file, {
                async: true
              })
              const uniqueId = generateUniqueId()
              picsData[uniqueId] = {
                name: '',
                filename: file,
                img: staticPath + file,
                desc: '',
                tags: '',
                address: '',
                edited: false
              }
              //// date: tags['DateTimeOriginal']?tags['DateTimeOriginal']['value'][0]:'',
              //// size: [tags['Image Width']?tags['Image Width']['value']:0, tags['Image Height']?tags['Image Height']['value']:0],
              //// camera: tags['Make']?tags['Make']['value'][0]:'' + ' ' + tags['Model']?tags['Model']['value'][0]:'',
              //// lens: tags['LensModel']?tags['LensModel']['description']:'',
              //// focal: tags['FocalLength']?tags['FocalLength']['description']:'',
              //// fstop: tags['FNumber']?tags['FNumber']['description']:'',
              //// shutter: tags['ExposureTime']? tags['ExposureTime']['description']:'',
              //// iso: tags['ISOSpeedRatings']?tags['ISOSpeedRatings']['description']:''
              if (tags.hasOwnProperty('Image Width') && tags.hasOwnProperty('Image Height')) {
                picsData[uniqueId]['size'] = [
                  tags['Image Width']['value'],
                  tags['Image Height']['value']
                ]
              } else {
                picsData[uniqueId]['size'] = [0, 0]
              }
              if (tags.hasOwnProperty('DateTimeOriginal')) {
                picsData[uniqueId]['date'] = tags['DateTimeOriginal']['value'][0]
              } else {
                picsData[uniqueId]['date'] = ''
              }
              if (tags.hasOwnProperty('Make') && tags.hasOwnProperty('Model')) {
                picsData[uniqueId]['camera'] =
                  tags['Make']['value'][0] + ' ' + tags['Model']['value'][0]
              } else {
                picsData[uniqueId]['camera'] = ''
              }
              if (tags.hasOwnProperty('LensModel')) {
                picsData[uniqueId]['lens'] = tags['LensModel']['description']
              } else {
                picsData[uniqueId]['lens'] = ''
              }
              if (tags.hasOwnProperty('FocalLength')) {
                picsData[uniqueId]['focal'] = tags['FocalLength']['description']
              } else {
                picsData[uniqueId]['focal'] = ''
              }
              if (tags.hasOwnProperty('FNumber')) {
                picsData[uniqueId]['fstop'] = tags['FNumber']['description']
              } else {
                picsData[uniqueId]['fstop'] = ''
              }
              if (tags.hasOwnProperty('ExposureTime')) {
                picsData[uniqueId]['shutter'] = tags['ExposureTime']['description']
              } else {
                picsData[uniqueId]['shutter'] = ''
              }
              if (tags.hasOwnProperty('ISOSpeedRatings')) {
                picsData[uniqueId]['iso'] = tags['ISOSpeedRatings']['description']
              } else {
                picsData[uniqueId]['iso'] = ''
              }
              await generateThumbnail(
                currentConfig.staticPath + picsDir + '/' + file,
                currentConfig.staticPath + thumbnailPicsDir + '/' + file,
                250,
                Math.round((picsData[uniqueId]['size'][1] / picsData[uniqueId]['size'][0]) * 250)
              )
                .then((info) => {
                  picsData[uniqueId].thumbnail = staticPath + 'thumbnails/' + file
                  console.log(`Thumbnail ${picsData[uniqueId]?.thumbnail} generated`)
                })
                .catch((err) => {
                  console.error('Error generating thumbnail:', err)
                })
            }
            fs.writeFile(
              currentConfig.staticPath + picsPath,
              JSON.stringify(picsData),
              (writeErr) => {
                if (writeErr) {
                  res.end(JSON.stringify({ success: false, msg: writeErr.message }))
                  return
                }
                res.end(JSON.stringify({ success: true }))
              }
            )
            return res.end(
              JSON.stringify({
                success: true,
                msg: '扫描完毕，添加了 ' + extraFiles.length + ' 张照片'
              })
            )
          } else {
            console.log('No extra files found.')
            return res.end(JSON.stringify({ success: true, msg: '扫描完毕，没有发现新照片' }))
          }
        })
        // if (picsData.hasOwnProperty(`${data['filename']}`)) {
        //     return res.end(JSON.stringify({success: false, error: "File already exists"}));
        // }
        // picsData[`${data['filename']}`] = data
        // fs.writeFile(picsPath, JSON.stringify(picsData), (writeErr) => {
        //     if (writeErr) {
        //         res.end(JSON.stringify({success: false, error: writeErr.message}));
        //         return;
        //     }
        //     res.end(JSON.stringify({success: true}));
        // });
      } catch (err) {
        res.end(JSON.stringify({ success: false, error: err.message }))
        return
      }
    })
    return
  }
  let filePath = '.' + decodeURIComponent(req.url)
  const extname = String(path.extname(filePath)).toLowerCase()
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.ico': 'image/x-icon'
  }
  const contentType = mimeTypes[extname] || 'application/octet-stream'
  // 处理静态文件请求
  fs.readFile(
    path.join(currentConfig.staticPath, filePath.replace('/static', '/')),
    (error, content) => {
      if (error) {
        res.writeHead(500)
        res.end('Sorry, an error occurred: ' + error.code)
      } else {
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(content, 'utf-8')
      }
    }
  )
})
// server.listen(0, () => {
//   console.log(`Server running at http://localhost:${server.address().port}/`)
//   serverPort = server.address().port
// })

listenServer(0)
