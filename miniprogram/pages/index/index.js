// pages/index/index.js

const { loadProgress, hasUnfinishedTraining, clearProgress, saveProgress } = require('../../utils/storage')

Page({
  data: {
    modes: [
      '本科毕设答辩',
      '硕士学位论文答辩',
      '博士学位论文答辩',
      '课程Pre汇报',
      '大作业汇报',
      '竞赛答辩',
      '求职面试模拟',
      '奖学金答辩'
    ],
    modeIndex: 3,
    difficulties: ['简单（5题）', '中等（8题）', '困难（12题）'],
    difficultyIndex: 1,
    userId: 'student_001',
    content: {},
    contentPreview: '',
    standard: {},
    standardPreview: '',
    otherInstruction: '',
    contentUploading: false,
    standardUploading: false,
    loading: false,
    showResumeDialog: false,
    resumeData: null
  },

  onShow() {
    if (hasUnfinishedTraining()) {
      const progress = loadProgress()
      this.setData({
        showResumeDialog: true,
        resumeData: progress
      })
    }
  },

  onModeChange(e) {
    this.setData({ modeIndex: parseInt(e.detail.value) })
  },

  onDifficultyChange(e) {
    this.setData({ difficultyIndex: parseInt(e.detail.value) })
  },

  onUserIdInput(e) {
    this.setData({ userId: e.detail.value })
  },

  onOtherInstructionInput (e) {
    this.setData({ otherInstruction: e.detail.value })
    const app = getApp()
    app.globalData.otherInstruction = e.detail.value
  },

  // ===== 选择并上传文件 =====
  async chooseFile(e) {
    const target = e.currentTarget.dataset.target

    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'md'],
          success: resolve,
          fail: reject
        })
      })

      const file = res.tempFiles[0]

      this.setData({ [`${target}Uploading`]: true })

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `documents/${Date.now()}_${file.name}`,
        filePath: file.path
      })

      const parseResult = await this.parseFileContent(uploadRes.fileID, file.name)

      // ===== 保存到全局 =====
      const app = getApp()
      if (target === 'content') {
        app.globalData.content = parseResult.text || ''
        app.globalData.fileName = file.name
        app.globalData.fileSize = (file.size / 1024).toFixed(1)
        app.globalData.contentName = file.name

        // ===== 保存进度 =====
        const mode = this.data.modes[this.data.modeIndex]
        const difficulty = this.data.difficulties[this.data.difficultyIndex]
        saveProgress({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1),
          content: parseResult.text || '',
          mode: mode,
          difficulty: difficulty,
          questions: [],
          currentQuestion: '',
          currentAnswer: '',
          completedQuestions: []
        })
        console.log('✅ 进度已保存')
      } else {
        app.globalData.standardText = parseResult.text || ''
        app.globalData.standardName = file.name
      }

      this.setData({
        [target]: parseResult,
        [`${target}Preview`]: parseResult.text ? parseResult.text.substring(0, 100) : '',
        [`${target}Uploading`]: false
      })

      wx.showToast({ title: '解析成功！', icon: 'success' })

    } catch (err) {
      this.setData({ [`${target}Uploading`]: false })
      console.error('解析失败:', err)
      wx.showToast({ title: err.message || '解析失败，请重试', icon: 'none' })
    }
  },

  // ===== 调用云函数解析文件 =====
  async parseFileContent(fileID, fileName) {
    wx.showLoading({ title: '解析文件中...' })
    const res = await wx.cloud.callFunction({
      name: 'parseDocument',
      data: { fileID, fileName }
    })
    wx.hideLoading()
    const result = res.result

    if (result && result.code === 0) {
      return result
    } else {
      wx.showToast({ title: result?.error || '解析结果为空', icon: 'none' })
      throw new Error(result?.error || '解析失败')
    }
  },

  // ===== 生成问题 =====
  async generateQuestions() {
    const contentText = this.data.content.text?.trim()
    if (!contentText) {
      wx.showToast({ title: '请先上传文档', icon: 'none' })
      return
    }

    // ===== 保存模式和难度到全局 =====
    const app = getApp()
    const selectedMode = this.data.modes[this.data.modeIndex]
    const selectedDifficulty = this.data.difficulties[this.data.difficultyIndex]
    app.globalData.mode = selectedMode
    app.globalData.difficulty = selectedDifficulty

    this.setData({ loading: true })
    wx.showLoading({ title: 'AI出题中...' })

    const questionCount = selectedDifficulty === '简单（5题）' ? 5 :
                          selectedDifficulty === '中等（8题）' ? 8 : 12

    const standardText = this.data.standard?.text?.trim() || ''
    const otherInstruction = this.data.otherInstruction?.trim() || ''

    try {
      const model = wx.cloud.extend.AI.createModel('hunyuan-exp')

      // ===== 读取用户记忆 =====
      const openid = app.globalData.openid || wx.getStorageSync('openid')
      let memoryPrompt = ''
      if (openid) {
        try {
          const db = wx.cloud.database()
          const res = await db.collection('user_memory').where({ openid: openid }).get()
          if (res.data.length > 0) {
            const memory = res.data[0]
            const tags = memory.weakness_tags || []
            if (tags.length > 0) {
              memoryPrompt = `【用户历史薄弱环节】该用户在上次练习中，在以下方面需要加强：${tags.join('、')}。请在本次出题时，优先关注这些方向。`
            }
          }
        } catch (err) {
          console.error('读取记忆失败:', err)
        }
      }

      let systemPrompt = `你是一位专业的答辩出题专家。请根据用户提供的文档内容`
      if (standardText) systemPrompt += '、评分标准'
      if (otherInstruction) systemPrompt += '及补充说明'
      systemPrompt += `，生成${questionCount}个有深度、有针对性的问题。问题应紧扣文档核心，并适当结合评分标准中的考察维度。`

      if (standardText) {
        systemPrompt += `\n\n【评分标准参考】\n${standardText.substring(0, 2000)}`
      }
      if (otherInstruction) {
        systemPrompt += `\n\n【补充说明/特殊要求】\n${otherInstruction.substring(0, 500)}`
      }

      let userPrompt = `文档内容：\n${contentText.substring(0, 8000)}`
      userPrompt += `\n\n答辩场景：${selectedMode}`
      userPrompt += `\n难度要求：${selectedDifficulty}`
      if (memoryPrompt) {
        userPrompt += `\n\n${memoryPrompt}`
      }
      userPrompt += `\n\n请按 Q1、Q2、Q3 格式输出${questionCount}个问题。`

      const res = await model.generateText({
        model: 'hunyuan-2.0-instruct-20251111',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })

      wx.hideLoading()
      this.setData({ loading: false })

      const result = res.choices[0].message.content
      const questions = result.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^Q\d+[.、：:]\s*/, '').trim())
        .filter(q => q)

      app.globalData.questions = questions.length > 0 ? questions : [result]
      app.globalData.content = this.data.content
      app.globalData.standard = this.data.standard
      app.globalData.otherInstruction = this.data.otherInstruction
      app.globalData.userId = this.data.userId
      app.globalData.mode = selectedMode
      app.globalData.difficulty = selectedDifficulty

      // ===== 更新进度 =====
      const progress = loadProgress()
      if (progress) {
        saveProgress({
          ...progress,
          questions: questions
        })
      }

      wx.navigateTo({
        url: '/pages/questions/questions'
      })

    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('AI 调用失败:', err.message, err.stack)
      wx.showToast({ title: '生成失败，请重试', icon: 'none' })
    }
  },

  // ===== 恢复训练 =====
  resumeTraining() {
    const progress = this.data.resumeData
    if (!progress) return

    const app = getApp()
    app.globalData.content = progress.content
    app.globalData.fileName = progress.fileName
    app.globalData.fileSize = progress.fileSize
    app.globalData.mode = progress.mode
    app.globalData.difficulty = progress.difficulty
    app.globalData.questions = progress.questions || []
    app.globalData.currentQuestion = progress.currentQuestion || ''

    if (progress.completedQuestions) {
      app.globalData.completedQuestions = progress.completedQuestions
    }

    this.setData({
      content: { text: progress.content || '' },
      contentPreview: progress.content ? progress.content.substring(0, 100) : '',
      showResumeDialog: false
    })

    const modeIndex = this.data.modes.indexOf(progress.mode)
    if (modeIndex >= 0) this.setData({ modeIndex: modeIndex })
    const diffIndex = this.data.difficulties.indexOf(progress.difficulty)
    if (diffIndex >= 0) this.setData({ difficultyIndex: diffIndex })

    if (progress.currentQuestion && progress.questions && progress.questions.length > 0) {
      wx.navigateTo({ url: '/pages/answer/answer' })
    } else if (progress.questions && progress.questions.length > 0) {
      wx.navigateTo({ url: '/pages/questions/questions' })
    } else {
      wx.showToast({ title: '已恢复文档，请重新生成问题', icon: 'success' })
    }
  },

  discardTraining() {
    clearProgress()
    this.setData({ showResumeDialog: false })
    wx.showToast({ title: '已放弃上次训练', icon: 'none' })
  }
})