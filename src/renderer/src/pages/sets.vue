<script setup>
import ImageSelectorDrawer from '../components/imageSelectorDrawer.vue'
import { onMounted, ref } from 'vue'
import axios from 'axios'
import qs from 'qs'
import { VueDraggable } from 'vue-draggable-plus'
import { Message } from '@arco-design/web-vue'
import {
  IconEdit,
  IconDelete,
  IconPlus,
  IconRefresh
} from '@arco-design/web-vue/es/icon'
import { useGlobalStore } from '../store'
import { judgeImagePath } from '../utils/utils'

const globalStore = useGlobalStore()
const projectPath = ref('')
const isMultipleSelect = ref(true)
const topImageKey = ref([])
const imageSelectedKeys = ref([])
const dragEl = ref(null)
const selectTopVisible = ref(false)
const editSetFlag = ref(false)
const selectPicVisible = ref(false)
const createSetVisible = ref(false)
const selectList = ref({})
const setsPage = ref(1)
const setsPageSize = ref(10)
const imagePreviewVisible = ref(false)
const imagePreviewSrc = ref('')
const createSetForm = ref({
  name: '',
  date: '',
  address: '',
  desc: '',
  pics: [],
  img: '',
  show: false,
  memo: false
})
globalStore.$subscribe(() => {
  projectPath.value = globalStore.projectPath
})
const showEditSet = (item) => {
  editSetFlag.value = true
  createSetVisible.value = true
  createSetForm.value = JSON.parse(JSON.stringify(item))
  if (createSetForm.value.hasOwnProperty('show')) {
    createSetForm.value['show'] = createSetForm.value['show'] === 'true'
  }
  if (createSetForm.value.hasOwnProperty('memo')) {
    createSetForm.value['memo'] = createSetForm.value['memo'] === 'true'
  }
  console.log(createSetForm.value)
  topImageKey.value[0] = createSetForm.value['img']
  // topImageKey.value[0] = Object.keys(globalStore.picsList).find(key => globalStore.picsList[key].img === createSetForm.value['img'])
  imageSelectedKeys.value = createSetForm.value['pics']
}
const deleteSet = (id) => {
  axios.post(`${projectPath.value}/api/deleteSet`, qs.stringify({ id })).then(res => {
    if (res.data.success) {
      Message.success(res.data.msg)
    } else {
      Message.error(res.data.msg)
    }
    globalStore.fetchSetsList()
  })
}
const handleCreateSet = (done) => {
  if (!createSetForm.value['name'] || !createSetForm.value['date'] || !createSetForm.value['address'] || !topImageKey.value.length || !imageSelectedKeys.value.length) {
    done(false)
    return Message.error('信息填写不全！')
  }
  createSetForm.value['pics'] = imageSelectedKeys.value
  createSetForm.value['img'] = topImageKey.value[0]
  axios.post(`${projectPath.value}/api/${editSetFlag.value ? 'updateSet' : 'newSet'}`, qs.stringify(createSetForm.value)).then(res => {
    if (res.data.success) {
      Message.success(res.data.msg)
    } else {
      Message.error(res.data.msg)
    }
    clearSetForm()
    done()
    createSetVisible.value = false
    globalStore.fetchSetsList()
  })
}
const showingSetsList = ref({})
const setsFilter = ref({
  type: 'all',
  name: ''
})
const handleSetsFilterType = (val) => {
  setsFilter.value['type'] = val
  runSetsFilter()
}
const handleSetsFilterName = (val) => {
  setsFilter.value['name'] = val
  runSetsFilter()
}
const runSetsFilter = async () => {
  showingSetsList.value = {}
  Object.entries(globalStore.setsList).forEach((item) => {
    if (
      setsFilter.value['type'] === 'memo' &&
      (!item[1].hasOwnProperty('memo') || item[1]['memo'] === 'false')
    ) {
      return
    }
    if (
      setsFilter.value['type'] === 'normal' &&
      item[1].hasOwnProperty('memo') &&
      item[1]['memo'] === 'true'
    ) {
      return
    }
    if (!item[1]['name'].includes(setsFilter.value['name'])) {
      return
    }
    showingSetsList.value[item[0]] = item[1]
  })
}
const clearSetForm = () => {
  createSetForm.value = {
    name: '',
    date: '',
    address: '',
    desc: '',
    pics: [],
    img: '',
    show: false,
    memo: false
  }
  topImageKey.value = []
  imageSelectedKeys.value = []
}
const selectTopPic = () => {
  selectList.value = {}
  imageSelectedKeys.value.forEach(key => {
    selectList.value[key] = globalStore.picsList[key]
  })
  selectTopVisible.value = true
}
const selectPics = () => {
  selectPicVisible.value = true
}
const selectPicsOver = (keys) => {
  imageSelectedKeys.value = keys
  if (topImageKey.value.length && !imageSelectedKeys.value.includes(topImageKey.value[0])) {
    topImageKey.value = []
  }
  selectPicVisible.value = false
}
const selectTopOver = (keys) => {
  topImageKey.value = keys
  selectTopVisible.value = false
}
onMounted(() => {
  globalStore.fetchSetsList()
  projectPath.value = globalStore.projectPath
  runSetsFilter()
})
globalStore.$subscribe(() => {
  projectPath.value = globalStore.projectPath
  runSetsFilter()
})
</script>

<template>
  <a-modal v-model:visible="createSetVisible" :title="editSetFlag?'编辑影集':'创建影集'" width="90%"
           @before-ok="handleCreateSet">
    <a-image-preview
      :src="judgeImagePath(imagePreviewSrc, projectPath)"
      v-model:visible="imagePreviewVisible"
    />
    <a-form :model="createSetForm" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item field="name" label="标题" required>
            <a-input v-model="createSetForm.name" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item field="address" label="地点" required>
            <a-input v-model="createSetForm.address" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item field="date" label="日期" required>
            <a-date-picker v-model="createSetForm.date" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="4">
          <a-form-item field="show" label="首页展示" required>
            <a-checkbox v-model="createSetForm.show">是否首页展示</a-checkbox>
          </a-form-item>
        </a-col>
        <a-col :span="16">
          <a-form-item field="memo" label="专题" required>
            <a-checkbox v-model="createSetForm.memo">
              （勾选此项将不在归档中显示，在默认模板中会展示到“一些記憶”页面）
            </a-checkbox>
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item field="address" label="描述" style="width: 100%;">
        <a-textarea v-model="createSetForm.desc" />
      </a-form-item>
      <a-form-item field="date" :label="`头图（先选择图片列表）（${ topImageKey.length }/1 张）`" required>
        <a-button type="primary" @click="selectTopPic">选择图片</a-button>
      </a-form-item>
      <div v-if="topImageKey.length" class="mb-2">
        <a-image height="220" fit="contain" class="max-w-full"
                 :src="judgeImagePath(globalStore.picsList[topImageKey[0]]?.img,projectPath)" />
      </div>
      <a-form-item field="address" :label="`图片列表（已选择 ${ imageSelectedKeys.length } 张）`" required>
        <a-button class="block" type="primary" @click="selectPics">选择图片</a-button>
      </a-form-item>
      <div class="w-full flex flex-wrap justify-items-start gap-1 max-h-[350px] overflow-y-scroll">
        <VueDraggable :animation="150" ref="dragEl" v-model="imageSelectedKeys">
          <a-image :preview="false" @click="()=>{
          imagePreviewVisible=true
          imagePreviewSrc=globalStore.picsList[item]?.img
        }" width="120" height="120" class="mr-1 cursor-pointer" v-for="item in imageSelectedKeys" :key="item"
                   fit="cover"
                   :src="judgeImagePath(globalStore.picsList[item]?.thumbnail,projectPath)" />
        </VueDraggable>
      </div>
    </a-form>
  </a-modal>
  <div class="main-container">
    <image-selector-drawer
      :selectedKeys="imageSelectedKeys"
      :list="globalStore.picsList"
      :multiple="isMultipleSelect"
      :visible="selectPicVisible"
      :project-path="projectPath"
      @ok="selectPicsOver"
      @close="selectPicVisible = false"
    />
    <!--       :selectedKeys="topImageKey"-->
    <image-selector-drawer
      :list="selectList"
      :multiple="false"
      :visible="selectTopVisible"
      :project-path="projectPath"
      @ok="selectTopOver"
      @close="selectTopVisible = false"
    />
    <a-button
      type="primary"
      @click="
        () => {
        editSetFlag=false
        createSetVisible = true
        clearSetForm()
      }">
      <template #icon>
        <icon-plus />
      </template>
      <!-- Use the default slot to avoid extra spaces -->
      <template #default>创建影集</template>
    </a-button>
    <a-button style="margin-left: 10px" type="primary" status="warning" @click="globalStore.fetchSetsList()">
      <template #icon>
        <icon-refresh />
      </template>
      <!-- Use the default slot to avoid extra spaces -->
      <template #default>刷新</template>
    </a-button>
    <div class="flex flex-wrap justify-items-start align-middle items-center gap-1 mt-4">
      <span>内容类型：</span>
      <a-radio-group type="button" :model-value="setsFilter['type']" @change="handleSetsFilterType">
        <a-radio value="all">全部</a-radio>
        <a-radio value="memo">专题</a-radio>
        <a-radio value="normal">普通</a-radio>
      </a-radio-group>
      <a-input-search class="ml-5" :value="setsFilter['name']" @input="handleSetsFilterName" :style="{width:'200px'}"
                      placeholder="名称检索" />
    </div>
    <div class="sets-list">
      <a-pagination show-total show-jumper show-page-size class="mt-4" :total="Object.keys(showingSetsList).length"
                    :current="setsPage" :page-size="setsPageSize"
                    @page-size-change="size=>setsPageSize = size"
                    @change="current => setsPage=current"
      />
      <div class="grid grid-cols-4 gap-4 mt-4">
        <a-card class="block mb-1"
                v-for="item in Object.entries(showingSetsList).slice((setsPage-1)*setsPageSize, setsPage*setsPageSize)"
                :key="item[0]">
          <template #cover>
            <div>
              <!--  :src="Object.values(picsList)?.find(el=>el['img']===item[1]['img'])?.thumbnail"-->
              <img
                style="width: 100%; height: 200px; object-fit: cover;"
                :src="
                  judgeImagePath(globalStore.picsList[item[1]['img']]?.['thumbnail'], projectPath)
                "
              />
            </div>
          </template>
          <a-card-meta :title="item[1].name">
            <template #description>
              <div class="mt-2 leading-5 truncate">
                {{ item[1].desc }}
              </div>
              <div class="mt-2">
                <a-tag>{{ item[1].date }}</a-tag>
                <a-tag class="ml-1">{{ item[1].pics.length }} PICS</a-tag>
                <a-tag class="ml-1">{{ item[1].address }}</a-tag>
              </div>
              <div class="mt-2">
                <a-button @click="showEditSet({id:item[0],...item[1]})" type="primary" class="mr-2" size="small">
                  <template #icon>
                    <icon-edit />
                  </template>
                </a-button>
                <a-popconfirm @ok="deleteSet(item[0])" content="确认删除该影集吗？" type="error">
                  <a-button type="primary" status="danger" size="small">
                    <template #icon>
                      <icon-delete />
                    </template>
                  </a-button>
                </a-popconfirm>
              </div>
            </template>
          </a-card-meta>
        </a-card>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
