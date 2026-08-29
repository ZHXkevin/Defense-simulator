// pages/report/detail/detail.js

Page({
  data: {
    record: {}
  },

  onShow() {
    const app = getApp()
    const record = app.globalData.currentReport || {}
    console.log('📋 报告详情数据:', record)  // 调试用
    this.setData({ record: record })
  },

  back() {
    wx.navigateBack({ delta: 1 })
  }
})