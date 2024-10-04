<script setup>
import { ref } from 'vue'
import { useGlobalStore } from '../store'
import { Message } from '@arco-design/web-vue'
import { IconEye, IconRefresh, IconSave } from '@arco-design/web-vue/es/icon'

const globalStore = useGlobalStore()
const form = ref({
  staticPath: '',
  template: '',
  exportPath: ''
})
const templatesList = ref([])
const selectStaticPath = async () => {
  const paths = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
  if (paths.length > 0) {
    form.value.staticPath = `${paths[0]}`
  }
}
const selectExportPath = async () => {
  const paths = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
  if (paths.length > 0) {
    form.value.exportPath = `${paths[0]}`
  }
}
const getTemplatesList = async () => {
  templatesList.value = await window.electron.ipcRenderer.invoke('get:templates')
}
const openTemplatesFolder = async () => {
  window.electron.ipcRenderer.send('open-folder', 'templates')
}
const saveConfig = async () => {
  if (!form.value.staticPath || !form.value.template) return Message.error('设置必填项请填写完整')
  const res = await window.electron.ipcRenderer.invoke('save:config', JSON.stringify(form.value))
  if (res) {
    Message.success('保存成功')
  } else {
    Message.error('保存失败')
  }
  globalStore.getConfig()
}
getTemplatesList()
globalStore.$subscribe(() => {
  form.value.staticPath = globalStore.config?.staticPath
  form.value.template = globalStore.config?.template
  form.value.exportPath = globalStore.config?.exportPath
})
form.value.staticPath = globalStore.config?.staticPath
form.value.template = globalStore.config?.template
form.value.exportPath = globalStore.config?.exportPath
</script>

<template>
  <a-form :model="form">
    <a-form-item field="staticPath" label="数据存放位置" validate-trigger="input" required>
      <a-input v-model="form.staticPath" placeholder="请输入本机绝对路径" />
      <a-button type="primary" class="ml-3" @click="selectStaticPath">
        <template #icon>
          <icon-eye />
        </template>
        浏览
      </a-button>
      <template #extra>
        <div>static目录的存放位置，设置之后的所有操作都会直接写入到该路径下的文件中</div>
      </template>
    </a-form-item>
    <a-form-item field="template" label="前端模板" validate-trigger="input" required>
      <a-select v-model="form.template" placeholder="请选择模板">
        <a-option v-for="item in templatesList" :value="item" :key="item">{{ item }}</a-option>
      </a-select>
      <a-button type="primary" class="ml-3" @click="getTemplatesList">
        <template #icon>
          <icon-refresh />
        </template>
        刷新
      </a-button>
      <a-button type="primary" class="ml-3" @click="openTemplatesFolder">模板目录</a-button>
      <template #extra>
        <div>你可以在模板目录中导入新的模板，导入后刷新页面或点击“刷新”</div>
      </template>
    </a-form-item>
    <a-form-item field="exportPath" label="站点生成位置" validate-trigger="input" required>
      <a-input v-model="form.exportPath" placeholder="请输入本机绝对路径" />
      <a-button type="primary" class="ml-3" @click="selectExportPath">
        <template #icon>
          <icon-eye />
        </template>
        浏览
      </a-button>
      <template #extra>
        <div>生成站点静态文件的存放位置，设置之后每次生成站点将不再询问保存路径。</div>
      </template>
    </a-form-item>
  </a-form>
  <div class="fixed w-screen h-16 bg-white bottom-0 left-0 flex items-center justify-end shadow-inner">
    <a-button type="primary" class="ml-3 mr-5" @click="saveConfig">
      <template #icon>
        <icon-save />
      </template>
      保存
    </a-button>
  </div>
</template>

<style scoped>

</style>
