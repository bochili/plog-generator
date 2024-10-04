import { defineStore } from 'pinia'
import axios from 'axios'

export const useGlobalStore = defineStore('global', {
  state: () => ({
    projectPath: '',
    picsList: {},
    setsList: {},
    config: {
      staticPath: '',
      template: '',
      exportPath: ''
    }
  }),
  actions: {
    async fetchPicsList() {
      if (this.projectPath === '') await this.getServerPort()
      await axios.get(`${this.projectPath}/api/gallery`).then((res) => {
        this.picsList = res.data
      })
    },
    async fetchSetsList() {
      if (this.projectPath === '') await this.getServerPort()
      await axios.get(`${this.projectPath}/api/sets`).then((res) => {
        this.setsList = res.data
      })
    },
    async getConfig() {
      this.config = await window.electron.ipcRenderer.invoke('get:config')
    },
    async getServerPort() {
      this.projectPath = `http://localhost:${await window.electron.ipcRenderer.invoke('get:port')}`
      console.log(this.projectPath)
    }
  }
})
