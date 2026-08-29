// ===== 微信云函数：文件文本解析 =====
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// ===== 文件解析函数 =====
async function parseFile(buffer, ext) {
  ext = ext
    .toLowerCase()
    .replace('.', '')
  let text = ''
  // ===== 1. PDF =====
  if (ext === 'pdf') {
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    text = data.text
  }
  // ===== 2. Word / PowerPoint =====
  else if (
    [
      'doc',
      'docx',
      'ppt',
      'pptx'
    ].includes(ext)
  ) {
    const fs = require('fs')
    // 微信云函数只有 /tmp 可写
    if (!fs.existsSync('/tmp/officeParserTemp')) {
        fs.mkdirSync(
            '/tmp/officeParserTemp',
            {
                recursive: true
            }
        )
    }
    // 切换工作目录
    process.chdir('/tmp')
    const officeParser = require('officeparser')
    text = await new Promise((resolve, reject)=>{
        officeParser.parseOffice(
            buffer,
            (data, err)=>{
                if(err){
                    reject(err)
                }
                else {
                    resolve(data || '')
                }
            }
        )
    })
  }
  // ===== 3. 纯文本 =====
  else if (
    [
      'txt',
      'md'
    ].includes(ext)
  ) {
    text = buffer.toString('utf-8')
  }
  // ===== 不支持格式 =====
  else {
    throw new Error(
      `暂不支持 .${ext} 文件`
    )
  }
  return text
}

// ===== 云函数入口 =====
exports.main = async (event, context) => {
  const {
    fileID,
    fileName
  } = event

  // 检查参数
  if (!fileID || !fileName) {
    return {
      code: -1,
      error: '缺少 fileID',
      text: ''
    }
  }

  try {
    // 下载云存储文件
    const downloadResult =
      await cloud.downloadFile({
        fileID
      })
    const buffer =
      downloadResult.fileContent
    // 获取扩展名
    let ext = fileName.split('.').pop().toLowerCase()
    // 文件解析
    let text =
      await parseFile(
        buffer,
        ext
      )
    // 清理多余空白
    text = text
      .replace(/\s+/g, ' ')
      .trim()
    // ===== 成功返回 =====
    return {
      code: 0,
      name: fileName,
      text: text.substring(0, 12000),
      size: buffer.length,
      ext: ext
    }
  }
  catch (err) {
    console.error(
      '文件解析失败:',
      err
    )
    // ===== 失败返回 =====
    return {
      code: -1,
      error: `解析失败: ${err.message}`,
      name: '',
      text: '',
      size: 0
    }
  }
}