// pages/history/history.js

Page({
  data: {
    records: [],
    avgStrictScore: 0,
    avgWarmScore: 0,
    // ===== 管理模式 =====
    isManageMode: false,
    selectedIds: [],
    selectedCount: 0,
    isAllSelected: false
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    try {
      const app = getApp()
      const db = wx.cloud.database()
      const openid = app.globalData.openid || wx.getStorageSync('openid')

      if (!openid) {
        wx.showToast({ title: '正在获取用户信息', icon: 'none' })
        return
      }

      const res = await db.collection('training_records')
        .where({ openid: openid })
        .orderBy('create_time', 'desc')
        .limit(100)
        .get()

      const records = res.data || []
      // 清除选中状态
      records.forEach(r => r.checked = false)
      this.setData({ records: records })
      this.calcStats()
      this.updateSelectedCount()

    } catch (err) {
      console.error('加载记录失败:', err)
      this.loadFromLocal()
    }
  },

  loadFromLocal() {
    try {
      const app = getApp()
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      const key = `training_records_${openid}`
      const records = wx.getStorageSync(key) || []
      records.forEach(r => r.checked = false)
      this.setData({ records: records })
      this.calcStats()
      this.updateSelectedCount()
    } catch (err) {
      console.error('加载本地记录失败:', err)
    }
  },

  calcStats() {
    const records = this.data.records
    if (records.length === 0) {
      this.setData({ avgStrictScore: 0, avgWarmScore: 0 })
      return
    }
    let strictSum = 0, warmSum = 0
    records.forEach(r => {
      strictSum += r.strict_score || 0
      warmSum += r.warm_score || 0
    })
    this.setData({
      avgStrictScore: Math.round(strictSum / records.length),
      avgWarmScore: Math.round(warmSum / records.length)
    })
  },

  // ===== 查看详情 =====
  viewDetail(e) {
    if (this.data.isManageMode) return
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find(r => r._id === id)
    if (!record) return

    const app = getApp()
    app.globalData.currentReport = record
    wx.navigateTo({
      url: '/pages/report/detail/detail'
    })
  },

  // ===== 切换管理模式 =====
  toggleManageMode() {
    const isManageMode = !this.data.isManageMode
    if (!isManageMode) {
      // 退出管理模式时清除所有选中
      const records = this.data.records
      records.forEach(r => r.checked = false)
      this.setData({ records: records })
      this.updateSelectedCount()
    }
    this.setData({ isManageMode: isManageMode })
  },

  // ===== 切换选中 =====
  toggleSelect(e) {
    if (!this.data.isManageMode) return
    
    const id = e.currentTarget.dataset.id
    const records = this.data.records
    const record = records.find(r => r._id === id)
    if (record) {
      record.checked = !record.checked
      this.setData({ records: records })
      this.updateSelectedCount()
    }
  },

  // ===== 全选/取消全选 =====
  selectAll() {
    const records = this.data.records
    const isAllSelected = this.data.isAllSelected
    records.forEach(r => r.checked = !isAllSelected)
    this.setData({ 
      records: records,
      isAllSelected: !isAllSelected
    })
    this.updateSelectedCount()
  },

  // ===== 更新选中数量 =====
  updateSelectedCount() {
    const selected = this.data.records.filter(r => r.checked)
    const selectedIds = selected.map(r => r._id)
    const isAllSelected = selected.length === this.data.records.length && this.data.records.length > 0
    this.setData({
      selectedCount: selected.length,
      selectedIds: selectedIds,
      isAllSelected: isAllSelected
    })
  },

  // ===== 删除选中的记录 =====
  deleteSelected() {
    const that = this
    const count = this.data.selectedCount

    if (count === 0) {
      wx.showToast({ title: '请先选择要删除的记录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${count} 条记录吗？`,
      confirmColor: '#F44336',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            
            const db = wx.cloud.database()
            const ids = that.data.selectedIds
            
            // 批量删除（每次最多删除20条）
            const batchSize = 20
            for (let i = 0; i < ids.length; i += batchSize) {
              const batch = ids.slice(i, i + batchSize)
              const promises = batch.map(id => {
                return db.collection('training_records').doc(id).remove()
              })
              await Promise.all(promises)
            }
            
            wx.hideLoading()
            wx.showToast({ title: `已删除 ${count} 条记录`, icon: 'success' })
            
            // 退出管理模式
            that.setData({ isManageMode: false })
            that.loadRecords()
            
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败:', err)
            wx.showToast({ title: '删除失败，请重试', icon: 'none' })
          }
        }
      }
    })
  },

  backHome() {
    wx.navigateBack({ delta: 1 })
  }
})