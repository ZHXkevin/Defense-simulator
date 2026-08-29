// pages/questions/questions.js

Page({
  data: {
    questions: []
  },

  onShow() {
    // 从全局获取问题列表
    const app = getApp()
    if (app.globalData && app.globalData.questions) {
      this.setData({ questions: app.globalData.questions })
    }
  },

  selectQuestion(e) {
    const index = e.currentTarget.dataset.index
    const question = this.data.questions[index]
    
    // 保存到全局
    const app = getApp()
    app.globalData.currentQuestion = question
    
    // 跳转到答题页
    wx.navigateTo({
      url: '/pages/answer/answer'
    })
  },

  backHome() {
    wx.navigateBack({ delta: 1 })
  }
})