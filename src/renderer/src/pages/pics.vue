<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import qs from 'qs'
import { VueDraggable } from 'vue-draggable-plus'
import { Message } from '@arco-design/web-vue'
import {
  IconEdit,
  IconDelete,
  IconRefresh,
  IconScan,
  IconUpload,
  IconCloud,
  IconFileImage,
  IconShrink
} from '@arco-design/web-vue/es/icon'
import ImageSelectorDrawer from '../components/imageSelectorDrawer.vue'
import { useGlobalStore } from '../store'
import { judgeImagePath } from '../utils/utils'

const projectPath = ref('http://localhost:3001')
const showingPicList = ref({})
const page = ref(1)
const pageSize = ref(40)
const globalStore = useGlobalStore()
const imagePreviewVisible = ref(false)
const imagePreviewSrc = ref('')
const picsFilter = ref({
  edited: 'all',
  address: '',
  name: '',
  tags: [],
  upload: 'all'
})
const genThumbnailLoading = ref(false)
const dragEl = ref(null)
const editPicForm = ref({})
const editPicVisible = ref(false)
const picsUploadVisible = ref(false)
const zipLocalModal = ref(false)
const picsUploadDrawerVisible = ref(false)
const picsUploadForm = ref({
  picgoURL: 'http://127.0.0.1:36677',
  absolutePath: '',
  selectedList: [],
  isDelete: true
})
const zipForm = ref({
  quality: 80
})
const picsUploadSelectedKeys = ref([])
const localImageList = ref({})
const selectLocalPics = () => {
  picsUploadDrawerVisible.value = true
  localImageList.value = {}
  Object.entries(globalStore.picsList).forEach(([key, value]) => {
    if (value['img'].startsWith('/static/pics/')) {
      localImageList.value[key] = value
    }
  })
}
const handleZipImage = async (done) => {
  const res = await window.electron.ipcRenderer.invoke('zip', zipForm.value['quality'])
  if (res === 0) {
    Message.success('压缩本地所有图片完成')
    zipLocalModal.value = false
    done()
  } else {
    Message.error(`压缩完成，出现错误图片${res}张`)
    zipLocalModal.value = false
    done()
  }
}
const handlePicsFilterEdited = (val) => {
  picsFilter.value['edited'] = val
  runPicsFilter()
}
const handlePicsFilterUploaded = (val) => {
  picsFilter.value['upload'] = val
  runPicsFilter()
}
const handlePicsFilterAddress = (val) => {
  picsFilter.value['address'] = val
  runPicsFilter()
}
const handlePicsFilterName = (val) => {
  picsFilter.value['name'] = val
  runPicsFilter()
}
const handlePicsFilterTags = (val) => {
  picsFilter.value['tags'] = val.split(',')
  runPicsFilter()
}
const handlePicsUpload = (done) => {
  if (!picsUploadForm.value['picgoURL'] || !picsUploadForm.value['absolutePath'] || !picsUploadSelectedKeys.value.length) {
    Message.error('信息填写不全！')
    done(false)
    return
  }
  const uploadList = []
  const selectedPicKeys = JSON.parse(JSON.stringify(picsUploadSelectedKeys.value))
  const updateData = {}
  picsUploadSelectedKeys.value.forEach(item => {
    uploadList.push(`${picsUploadForm.value.absolutePath}${globalStore.picsList[item]['img']}`)
  })
  axios.post(`${picsUploadForm.value.picgoURL}/upload`, {
    'list': uploadList
  }).then(res => {
    if (res.data.success) {
      res.data.result.forEach((el, index) => {
        updateData[selectedPicKeys[index]] = el
      })
      axios.post(`${projectPath.value}/api/updatePicsUrl`, qs.stringify({
        data: updateData,
        isDelete: picsUploadForm.value.isDelete
      })).then(res => {
        Message.success('上传完成！')
        done()
        globalStore.fetchPicsList()
      }).catch((err) => {
        Message.error('上传失败！')
        done(false)
      })
    } else {
      Message.error('上传失败！')
      done(false)
    }
  }).catch(err => {
    Message.error('上传失败！')
    done(false)
  })
}
const selectUpladPicsOver = (keys) => {
  picsUploadSelectedKeys.value = keys
  picsUploadDrawerVisible.value = false
}
const deletePic = (id) => {
  axios.post(`${projectPath.value}/api/deletePic`, qs.stringify({ id })).then(res => {
    if (res.data.success) {
      Message.success(res.data.msg)
    } else {
      Message.error(res.data.msg)
    }
    globalStore.fetchPicsList()
  })
}
const handleEditPic = (done) => {
  axios.post(`${projectPath.value}/api/updatePic`, qs.stringify(editPicForm.value)).then(res => {
    if (res.data.success) {
      Message.success(res.data.msg)
    } else {
      Message.error(res.data.msg)
    }
    globalStore.fetchPicsList()
    done()
  })
}
const runPicsFilter = async () => {
  showingPicList.value = {}
  Object.entries(globalStore.picsList).forEach((item) => {
    if (picsFilter.value['edited'] === 'no' && item[1]['edited'] === true) {
      return
    }
    if (picsFilter.value['edited'] === 'yes' && item[1]['edited'] === false) {
      return
    }
    if (picsFilter.value['upload'] === 'external' && item[1]['img'].startsWith('/static/pics/')) {
      return
    }
    if (picsFilter.value['upload'] === 'local' && !item[1]['img'].startsWith('/static/pics/')) {
      return
    }
    if (!item[1]['address'].includes(picsFilter.value['address'])) {
      return
    }
    if (!item[1]['name'].includes(picsFilter.value['name'])) {
      return
    }
    const tagFilterSet = new Set(picsFilter.value['tags'])
    if (picsFilter.value['tags'].length && !(item[1]['tags'].split(',')).some(tag => tagFilterSet.has(tag))) {
      return
    }
    showingPicList.value[item[0]] = item[1]
  })
}
const scanning = ref(false)
const scanPicDir = () => {
  scanning.value = true
  axios.get(`${projectPath.value}/api/scanPics`).then(res => {
    if (res.data.success) {
      Message.success(res.data.msg)
    } else {
      Message.error(res.data.msg)
    }
    scanning.value = false
    globalStore.fetchPicsList()
  })
}
const regenThumbnail = async () => {
  genThumbnailLoading.value = true
  await window.electron.ipcRenderer.invoke('regen-thumbnail')
  genThumbnailLoading.value = false
  globalStore.fetchPicsList()
}
const genThumbnailSpecificLoading = ref(false)
const regenThumbnailSpecific = async (id) => {
  genThumbnailSpecificLoading.value = true
  const res = await window.electron.ipcRenderer.invoke('regen-thumbnail-specific', id)
  genThumbnailSpecificLoading.value = false
  if (res) {
    Message.success('生成完成！')
    editPicForm.value['thumbnail'] = res
    globalStore.fetchPicsList()
  } else {
    Message.error('生成失败！')
  }
}
const openPicsFolder = () => {
  window.electron.ipcRenderer.send('open-folder', 'pics')
}
onMounted(() => {
  globalStore.fetchPicsList()
  projectPath.value = globalStore.projectPath
  runPicsFilter()
})
globalStore.$subscribe(() => {
  projectPath.value = globalStore.projectPath
  runPicsFilter()
})

function removeStaticSuffix(staticPath) {
  if (!staticPath) return staticPath

  // 正则匹配末尾的 'static', 'static/' 或 'static\\'
  return staticPath.replace(/[/\\]?static[/\\]?$/, '')
}
</script>

<template>
  <div class="main-container">
    <a-modal v-model:visible="editPicVisible" title="编辑相片" @before-ok="handleEditPic">
      <a-form :model="editPicForm">
        <a-form-item field="name" label="标题" required>
          <a-input v-model="editPicForm.name" />
        </a-form-item>
        <a-form-item field="address" label="地点" required>
          <a-input v-model="editPicForm.address" />
        </a-form-item>
        <a-form-item field="date" label="日期" required>
          <a-date-picker show-time v-model="editPicForm.date" />
        </a-form-item>
        <a-form-item field="address" label="描述" :required="false">
          <a-textarea v-model="editPicForm.desc" />
        </a-form-item>
        <a-form-item field="img" label="图片" required>
          <div class="w-full">
            <a-textarea v-model="editPicForm.img" class="w-[100%] block" />
            <img @click="()=>{imagePreviewVisible=true;imagePreviewSrc=editPicForm.img}"
                 :src="judgeImagePath(editPicForm.img,projectPath)"
                 class="w-[250px] max-h-[250px] block object-contain object-left-top" />
          </div>
        </a-form-item>
        <a-form-item field="img" label="缩略图" required>
          <div class="w-full">
            <a-textarea disabled v-model="editPicForm.thumbnail" class="w-[100%] block" />
            <a-button :loading="genThumbnailSpecificLoading" @click="regenThumbnailSpecific(editPicForm.id)"
                      type="primary">重新生成
            </a-button>
          </div>
        </a-form-item>
        <a-form-item field="tags" label="标签" required>
          <a-input v-model="editPicForm.tags" placeholder="逗号分隔" />
        </a-form-item>
        <a-form-item field="camera" label="相机型号" required>
          <a-input v-model="editPicForm.camera" placeholder="相机型号" />
        </a-form-item>
        <a-form-item field="lens" label="镜头型号" required>
          <a-input v-model="editPicForm.lens" placeholder="镜头型号" />
        </a-form-item>
        <a-form-item field="focal" label="焦距" required>
          <a-input v-model="editPicForm.focal" placeholder="焦距" />
        </a-form-item>
        <a-form-item field="fstop" label="光圈" required>
          <a-input v-model="editPicForm.fstop" placeholder="光圈" />
        </a-form-item>
        <a-form-item field="shutter" label="快门" required>
          <a-input v-model="editPicForm.shutter" placeholder="快门速度" />
        </a-form-item>
        <a-form-item field="iso" label="ISO" required>
          <a-input v-model="editPicForm.iso" placeholder="感光度" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal v-model:visible="picsUploadVisible" title="使用PICGO上传本地图片" width="50%"
             @before-ok="handlePicsUpload">
      <a-image-preview
        :src="judgeImagePath(imagePreviewSrc, projectPath)"
        v-model:visible="imagePreviewVisible"
      />
      <a-form :model="picsUploadForm" layout="vertical">
        <a-row>
          <a-col>
            <a-form-item field="picgoURL" label="PICGO SERVER URL" required>
              <a-input v-model="picsUploadForm.picgoURL" />
            </a-form-item>
            <a-form-item field="picgoURL" label="图片存放文件夹绝对路径(指向到static上一级目录)" required>
              <a-input v-model="picsUploadForm.absolutePath" />
            </a-form-item>
            <a-form-item field="isDelete" label="上传后删除本地图片" required>
              <a-checkbox v-model="picsUploadForm.isDelete">是否删除</a-checkbox>
            </a-form-item>
          </a-col>
          <a-form-item field="selectedList" :label="`图片列表（已选择 ${ picsUploadSelectedKeys.length } 张）`" required>
            <a-button class="block" type="primary" @click="selectLocalPics">选择图片</a-button>
            <!--            <span class="ml-4">考虑到图片上传时间，请不要一次性选太多照片上传，可以分开多次。</span>-->
          </a-form-item>
          <div class="w-full flex flex-wrap justify-items-start gap-1 max-h-[350px] overflow-y-scroll">
            <VueDraggable :animation="150" ref="dragEl" v-model="picsUploadSelectedKeys">
              <a-image :preview="false" @click="()=>{
          imagePreviewVisible=true
          imagePreviewSrc=judgeImagePath(globalStore.picsList[item]?.img, projectPath)
        }" width="120" height="120" class="mr-1 cursor-pointer" v-for="item in picsUploadSelectedKeys" :key="item"
                       fit="cover"
                       :src="judgeImagePath(globalStore.picsList[item].thumbnail, projectPath)" />
            </VueDraggable>
          </div>
        </a-row>
      </a-form>
    </a-modal>
    <a-modal v-model:visible="zipLocalModal" title="批量压缩本地所有JPG图片" width="50%"
             @before-ok="handleZipImage">
      <a-form :model="zipForm" layout="vertical">
        <a-row>
          <a-col>
            <a-form-item field="JPG压缩质量" label="JPG压缩质量">
              <a-slider
                style="width: 60%"
                :model-value="zipForm.quality"
                :min="10"
                @change="(value) => (zipForm.quality = value)"
              />
              <span class="pl-5"> {{ zipForm.quality }} %</span>
            </a-form-item>
          </a-col>
        </a-row>
        <div>提示：该操作会压缩图片目录下所有JPG后缀的图片文件，并覆盖原文件（不包含子目录），<span class="text-red-500">此操作不可逆</span>。
        </div>
        <div class="mt-3 text-yellow-600">
          本次压缩本地图片数量：{{ Object.values(globalStore.picsList).filter(pic => pic.img.startsWith('/static/pics')).length
          }}
        </div>
      </a-form>
    </a-modal>
    <image-selector-drawer :selectedKeys="picsUploadSelectedKeys" :list="localImageList" :project-path="projectPath"
                           :multiple="true"
                           @ok="selectUpladPicsOver"
                           @close="picsUploadDrawerVisible=false" :visible="picsUploadDrawerVisible" />
    <a-image-preview
      :src="judgeImagePath(imagePreviewSrc, projectPath)"
      v-model:visible="imagePreviewVisible"
    />

    <div class="ml-0 mt-2">
      <a-button style="margin-left:10px;" type="primary" status="success" @click="globalStore.fetchPicsList">
        <template #icon>
          <icon-refresh />
        </template>
        <!-- Use the default slot to avoid extra spaces -->
        <template #default>刷新</template>
      </a-button>
      <a-button style="margin-left:10px;" type="primary" status="warning" :loading="scanning" @click="scanPicDir">
        <template #icon>
          <icon-scan />
        </template>
        <!-- Use the default slot to avoid extra spaces -->
        <template #default>扫描</template>
      </a-button>
      <a-button style="margin-left:10px;" type="primary" @click="()=>{
        picsUploadVisible=true;
        picsUploadSelectedKeys=[]
        picsUploadForm.absolutePath = removeStaticSuffix(globalStore.config?.staticPath)
        console.log(picsUploadForm.absolutePath)
      }">
        <template #icon>
          <icon-upload />
        </template>
        <!-- Use the default slot to avoid extra spaces -->
        <template #default>PICGO上传</template>
      </a-button>
      <a-button style="margin-left:10px;" type="primary" @click="()=>{
        zipLocalModal=true;
      }">
        <template #icon>
          <icon-shrink />
        </template>
        <!-- Use the default slot to avoid extra spaces -->
        <template #default>压缩本地图片</template>
      </a-button>
      <a-button style="margin-left:10px;" type="primary" @click="openPicsFolder">
        <template #icon>
          <icon-file-image />
        </template>
        <!-- Use the default slot to avoid extra spaces -->
        <template #default>打开图片目录</template>
      </a-button>
      <a-button style="margin-left:10px;" type="primary" :loading="genThumbnailLoading" @click="regenThumbnail">
        <template #icon>
          <icon-file-image />
        </template>
        <!-- Use the default slot to avoid extra spaces -->
        <template #default>重新生成没有的缩略图</template>
      </a-button>
    </div>
    <div class="flex flex-wrap justify-items-start align-middle items-center gap-1 mt-4">
      <span>编辑状态：</span>
      <a-radio-group type="button" :model-value="picsFilter['edited']" @change="handlePicsFilterEdited">
        <a-radio value="all">全部</a-radio>
        <a-radio value="no">未编辑</a-radio>
        <a-radio value="yes">已编辑</a-radio>
      </a-radio-group>
      <span class="ml-5">图片位置：</span>
      <a-radio-group type="button" :model-value="picsFilter['upload']" @change="handlePicsFilterUploaded">
        <a-radio value="all">全部</a-radio>
        <a-radio value="external">外链</a-radio>
        <a-radio value="local">本地</a-radio>
      </a-radio-group>
      <a-input-search class="ml-5" :value="picsFilter['name']" @input="handlePicsFilterName" :style="{width:'200px'}"
                      placeholder="名称检索" />
      <a-input-search class="ml-3" :value="picsFilter['address']" @input="handlePicsFilterAddress"
                      :style="{width:'200px'}" placeholder="地点检索" />
      <a-input-search class="ml-3" :value="picsFilter['tags']" @input="handlePicsFilterTags" :style="{width:'200px'}"
                      placeholder="标签检索，逗号分隔" />
    </div>
    <a-pagination show-total show-jumper show-page-size class="mt-2" :total="Object.keys(showingPicList).length"
                  :current="page" :page-size="pageSize"
                  @page-size-change="size=>pageSize = size"
                  @change="current => page=current"
    />
    <div class="mt-4 flex flex-wrap flex-row justify-items-start gap-2">
      <div class="mb-1 relative cursor-pointer"
           v-for="item in Object.entries(showingPicList).slice((page-1)*pageSize, page*pageSize)"
           :key="item"
      >
        <a-image :src="judgeImagePath(item[1].thumbnail || item[1].img, projectPath)"
                 @click="()=>{imagePreviewVisible=true;imagePreviewSrc = item[1].img;}"
                 footer-position="outer" :preview="false" fit="cover"
                 width="200" height="200">
        </a-image>
        <div class="absolute top-2 left-2 w-full">
          <a-button type="dashed" @click="ev => {editPicForm={...item[1],id:item[0]};editPicVisible=true}"
                    shape="round" size="small">
            <template #icon>
              <icon-edit />
            </template>
          </a-button>
          <a-popconfirm @ok="deletePic(item[0])" content="确定要删除吗？">
            <a-button type="dashed" shape="round" status="danger" class="float-right right-4" size="small">
              <template #icon>
                <icon-delete />
              </template>
            </a-button>
          </a-popconfirm>
        </div>
        <div class="absolute bottom-2 left-2 text-white drop-shadow text-xl"
             v-if="!item[1].img.startsWith('/static/pics/')">
          <icon-cloud />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
