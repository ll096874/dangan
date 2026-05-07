/**
 * 档案自动分类程序 v2.0
 * 读取 PDF 全文内容进行分析，离线运行（使用 pdfjs-dist）
 *
 * 用法: node archive-classifier.js <文件夹路径> [输出目录]
 * 示例: node archive-classifier.js D:\档案文件
 *       node archive-classifier.js D:\档案文件 D:\归档结果
 */

const fs = require('fs');
const path = require('path');

// pdfjs-dist 需要 DOMMatrix polyfill（Node.js 环境）
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1;
      this.e = 0; this.f = 0;
    }
    scale() { return this; }
    translate() { return this; }
    rotate() { return this; }
    multiply() { return this; }
    toString() { return ''; }
  };
}

// ============ 分类规则（大类 + 小类） ============

const SUBCATEGORIES = [
  {
    code: 'A', name: 'A类-党群工作',
    keywords: [
      '党委', '党组', '党支部', '党总支', '党员', '党建', '党务',
      '纪委', '纪检监察', '纪检', '巡察', '巡视',
      '工会', '团委', '妇联', '统战', '民主党派',
      '宣传', '组织', '精神文明', '思想政治', '理论学习',
      '主题教育', '党史', '廉政', '作风建设',
      '入党', '党费', '党组织', '党性', '党',
    ],
    subcategories: [
      { id: '1', name: '党委综合性工作', keywords: ['党委', '三重一大', '巡察', '巡视', '党员代表大会', '党代会', '保密', '规章制度', '条例', '办法'] },
      { id: '2', name: '党群机构设置', keywords: ['机构设置', '组织工作', '党员管理', '党员名册', '干部考察', '干部任免', '任免', '党组织关系', '招聘', '统计年报', '编制'] },
      { id: '3', name: '宣传教育统战', keywords: ['宣传', '出版', '报刊', '广播', '精神文明建设', '统战', '民主党派', '无党派', '民族', '宗教', '港澳台'] },
      { id: '4', name: '纪检监察', keywords: ['党风', '党纪', '纪检', '监察', '案件', '信访', '廉政', '违纪', '效能监察', '审理'] },
      { id: '5', name: '工会工作', keywords: ['工会', '职工代表大会', '职代会', '劳动竞赛', '表彰', '劳保', '女工', '文体', '光荣册'] },
      { id: '6', name: '共青团工作', keywords: ['团组织', '团员', '共青团', '团委', '青年', '政治思想教育'] },
      { id: '7', name: '学会协会', keywords: ['学会', '协会', '群众团体'] },
    ]
  },
  {
    code: 'B', name: 'B类-行政管理',
    keywords: [
      '会议纪要', '纪要', '通知', '请示', '批复',
      '制度', '章程', '管理办法', '规定', '细则',
      '报告', '总结', '计划', '简报', '函',
      '行政', '办公', '人事', '考勤',
      '任免', '招聘', '培训', '考核',
      '工作要点', '工作安排', '方案',
      '后勤', '接待', '公文', '保密',
    ],
    subcategories: [
      { id: '1', name: '行政事务', keywords: ['行政', '会议纪要', '纪要', '办公', '文秘', '董事会', '监事会', '股东会', '督查', '制度', '规章'] },
      { id: '2', name: '劳动人事', keywords: ['人事', '劳动', '招聘', '任免', '考勤', '薪酬', '工资', '社保', '劳动合同', '用工'] },
      { id: '3', name: '教育培训', keywords: ['培训', '教育', '进修', '学习', '继续教育', '培训计划'] },
      { id: '4', name: '后勤福利', keywords: ['后勤', '福利', '公积金', '食堂', '宿舍', '车辆', '办公用品'] },
      { id: '5', name: '医疗卫生', keywords: ['医疗', '卫生', '健康', '体检', '防疫', '医保', '职业病'] },
      { id: '6', name: '档案工作', keywords: ['档案', '归档', '文件管理', '档案管理'] },
      { id: '7', name: '武装保卫', keywords: ['武装', '保卫', '消防', '治安', '安保', '门卫'] },
      { id: '8', name: '外事外贸', keywords: ['外事', '外贸', '外宾', '出国', '涉外', '外事活动'] },
    ]
  },
  {
    code: 'C', name: 'C类-经营管理',
    keywords: [
      '董事会决议', '董事会', '股东会', '监事会',
      '董事', '监事', '股东',
      '经营', '业务', '合同', '协议',
      '项目', '投资', '招标', '投标', '采购', '销售',
      '拆迁补偿', '拆迁', '补偿',
      '产权', '股权', '出资',
      '工程', '建设', '技术', '研发',
    ],
    subcategories: [
      { id: '1', name: '合同', keywords: ['合同', '协议'] },
      { id: '2', name: '企业经营考核决策', keywords: ['经营', '考核', '决策', '经营目标', '经营计划', '经济责任制'] },
      { id: '3', name: '计划统计', keywords: ['计划', '统计', '年报', '指标', '统计分析'] },
      { id: '4', name: '法律事务', keywords: ['法律', '诉讼', '律师', '法务', '合规', '公证'] },
      { id: '5', name: '对外协调', keywords: ['对外', '协调', '政府', '外部', '联系'] },
      { id: '6', name: '计量', keywords: ['计量', '测量', '仪器', '仪表'] },
      { id: '7', name: '财务管理', keywords: ['财务', '会计', '税务', '预算', '决算', '凭证', '发票', '报销', '银行', '贷款', '经费'] },
      { id: '8', name: '物资管理', keywords: ['物资', '采购', '招标', '投标', '供应', '仓储'] },
      { id: '9', name: '审计稽查', keywords: ['审计', '稽查', '内审', '审计报告'] },
      { id: '10', name: '煤质运销产品', keywords: ['煤质', '运销', '销售', '产品', '定价'] },
      { id: '11', name: '多种经营', keywords: ['多种经营', '子公司', '三产', '三产企业'] },
    ]
  },
  {
    code: 'D', name: 'D类-生产',
    keywords: [
      '生产', '安全', '矿井', '采煤', '掘进', '机电',
      '通风', '调度', '环保', '质量',
      '基建', '工程', '技术', '选煤',
    ],
    subcategories: [
      { id: '1', name: '煤炭生产', keywords: ['煤炭生产', '技术规程', '操作规程', '经验汇编', '生产制度'] },
      { id: '2', name: '矿井开拓采掘', keywords: ['开拓', '采区', '盘区', '掘进', '采煤', '顶板', '采掘', '设计'] },
      { id: '3', name: '质量管理', keywords: ['质量管理', '质量检测', '质量控制', '产品质量', '全面质量管理'] },
      { id: '4', name: '安全管理', keywords: ['安全', '消防', '事故', '工伤', '安全生产', '安全培训', '救护', '安全责任制', '安全法规'] },
      { id: '5', name: '调度信息', keywords: ['调度', '信息', '信息系统', '调度指挥'] },
      { id: '6', name: '能源管理', keywords: ['能源', '能耗', '节能', '降耗', '定额'] },
      { id: '7', name: '环境保护', keywords: ['环保', '环境', '污染', '监测', '排放', '治理'] },
      { id: '8', name: '标准化管理', keywords: ['标准化', '规范', '技术规范', '生产技术'] },
      { id: '9', name: '基本建设', keywords: ['基建', '建设', '工程', '土地复垦', '边坡', '滑坡', '兼并重组', '整合', '施工'] },
      { id: '10', name: '机电管理', keywords: ['机电', '供水', '供热', '压风', '配电', '电力', '电气'] },
      { id: '11', name: '运输提升', keywords: ['运输', '提升', '胶带', '轨道', '输送'] },
      { id: '12', name: '通风防灭火', keywords: ['通风', '瓦斯', '煤尘', '防灭火', '粉尘', '风量'] },
      { id: '13', name: '地测管理', keywords: ['地质', '水文', '矿业权', '探水', '排水', '防治水', '储量', '地测'] },
      { id: '14', name: '选煤技术', keywords: ['选煤', '煤炭加工', '气化', '液化', '煤泥水'] },
      { id: '15', name: '矿井报废', keywords: ['矿井报废', '关闭', '闭坑'] },
    ]
  }
];

const RETENTION_RULES = [
  {
    code: 'Y', label: '永久',
    keywords: [
      '董事会决议', '股东会决议', '监事会决议',
      '章程', '年报', '年度报告',
      '名册', '花名册', '清册',
      '产权证', '房产证', '土地证',
      '资质', '许可证', '营业执照', '批准证书',
      '审计报告', '验资报告', '评估报告',
      '拆迁补偿',
      '股权', '出资',
      '合同', '制度', '人事', '任免', '职工奖惩',
    ]
  },
  {
    code: 'D30', label: '30年',
    keywords: [
      '协议', '管理办法', '规定', '细则',
      '会议记录', '项目', '工程',
      '请示', '批复',
      '规划', '计划',
    ]
  }
];

const DEFAULT_RETENTION = { code: 'D10', label: '10年' };

// ============ PDF 文本提取 ============

let pdfjsCache = null;

async function getPDFjs() {
  if (!pdfjsCache) {
    pdfjsCache = await import('./node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsCache;
}

async function extractText(filePath) {
  let doc = null;
  try {
    const buf = fs.readFileSync(filePath);
    const pdfjs = await getPDFjs();
    // 独立拷贝，避免 Node Buffer 与异步解析共用底层 ArrayBuffer 导致不稳定
    const data = new Uint8Array(buf);
    doc = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;

    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join('') + '\n';
    }
    return { text: text.trim(), pages: doc.numPages };
  } catch {
    return { text: '', pages: '?' };
  } finally {
    if (doc && typeof doc.destroy === 'function') {
      try {
        await doc.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}

// ============ 分析函数 ============

function determineRetention(text, filename) {
  const combined = text + '\n' + filename;

  for (const rule of RETENTION_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) return rule;
    }
  }
  return DEFAULT_RETENTION;
}

function classifyDocument(text, filename) {
  const combined = text + '\n' + filename;

  // 党政联席归入 B类-行政管理
  if (combined.includes('党政联席')) {
    const bCat = SUBCATEGORIES.find(c => c.code === 'B');
    return {
      category: { code: 'B', name: 'B类-行政管理' },
      subcategory: bCat.subcategories[0]
    };
  }

  // 1. 评分：确定所属大类
  const scored = SUBCATEGORIES.map(cat => {
    let score = 0;
    for (const kw of cat.keywords) {
      if (text.includes(kw)) score += kw.length * 3;
      if (filename.includes(kw)) score += kw.length * 2;
    }
    return { ...cat, score };
  }).sort((a, b) => b.score - a.score);

  // 未匹配任何大类
  if (scored[0].score <= 0) {
    return {
      category: { code: '?', name: '未分类' },
      subcategory: { id: '-', name: '-' }
    };
  }

  const mainCat = scored[0];

  // 2. 在大类内评分小类
  const subScored = mainCat.subcategories.map(sub => {
    let score = 0;
    for (const kw of sub.keywords) {
      if (text.includes(kw)) score += kw.length * 3;
      if (filename.includes(kw)) score += kw.length * 2;
    }
    return { ...sub, score };
  }).sort((a, b) => b.score - a.score);

  // 小类无匹配则默认取第 1 个
  const subcat = subScored[0].score > 0 ? subScored[0] : mainCat.subcategories[0];

  return {
    category: { code: mainCat.code, name: mainCat.name },
    subcategory: subcat
  };
}

// 判断文件级别：正旺煤业 → 本级文，其余（汾西矿业、孝义公司等）→ 上级文
function isUpperLevel(text, filename) {
  return !(text + '\n' + filename).includes('正旺');
}

// ============ 文件扫描 ============

function scanPDFs(dirPath) {
  const results = [];
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (/\.pdf$/i.test(entry.name)) results.push(fullPath);
      }
    } catch {}
  }
  walk(dirPath);
  return results;
}

function findAttachments(pdfPath) {
  const dir = path.dirname(pdfPath);
  const pdfName = path.basename(pdfPath);
  const attachments = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      // 排除自身，但发文卡 PDF 视为附件
      if (entry.name === pdfName) continue;
      if (/\.pdf$/i.test(entry.name) && !entry.name.includes('发文卡')) continue;
      attachments.push(path.join(dir, entry.name));
    }
  } catch {}
  return attachments;
}

// ============ 创建目录结构 ============

function createArchiveStructure(baseDir) {
  const dirs = ['永久', '30年', '10年'];
  const levelDirs = ['本级文', '上级文'];
  const created = [];

  for (const cat of SUBCATEGORIES) {
    const catDir = path.join(baseDir, cat.code);
    fs.mkdirSync(catDir, { recursive: true });
    created.push(catDir);
    for (const d of dirs) {
      const retDir = path.join(catDir, d);
      fs.mkdirSync(retDir, { recursive: true });
      created.push(retDir);
      for (const sub of cat.subcategories) {
        const subDir = path.join(retDir, sub.name);
        fs.mkdirSync(subDir, { recursive: true });
        created.push(subDir);
        for (const ld of levelDirs) {
          fs.mkdirSync(path.join(subDir, ld), { recursive: true });
          created.push(path.join(subDir, ld));
        }
      }
    }
  }

  const uncatDir = path.join(baseDir, '未分类');
  fs.mkdirSync(uncatDir, { recursive: true });
  created.push(uncatDir);
  return created;
}

// ============ 归档文件 ============

/** Windows 文件名非法字符，避免目标路径异常 */
function safePathSegment(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

/**
 * 单文件复制（避免 fs.cpSync 在部分环境下触发进程级崩溃，改用 copyFileSync）
 */
function copyOneFile(src, dest) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  } catch {
    /* 目标不可删时仍尝试覆盖写入 */
  }
  fs.copyFileSync(src, dest);
}

function organizeFiles(rows, outputDir) {
  let copied = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const safeName = safePathSegment(row.name);

    // 未分类
    if (row.category.code === '?') {
      const dest = path.join(outputDir, '未分类', safeName + '.pdf');
      try {
        copyOneFile(row.fullPath, dest);
        copied++;
      } catch (e) { skipped++; errors.push(`${row.name}.pdf: ${e.message}`); }
      continue;
    }

    const baseDir = path.join(
      outputDir,
      row.category.code,
      row.retention.label,
      safePathSegment(row.subcategory.name)
    );
    const levelDir = path.join(baseDir, row.isUpper ? '上级文' : '本级文');
    const hasAttachments = row.attachments && row.attachments.length > 0;

    // 诊断：打印每条记录的拷贝路径
    if (hasAttachments) {
      const subDir = path.join(levelDir, safeName);
      for (const f of [row.fullPath, ...row.attachments]) {
        const dest = path.join(subDir, safePathSegment(path.basename(f)));
        try {
          console.log(`  📎 ${row.name} → ${dest}`);
          copyOneFile(f, dest);
          copied++;
        } catch (e) { skipped++; errors.push(`附件 ${path.basename(f)}: ${e.message}`); }
      }
    } else {
      const dest = path.join(levelDir, safeName + '.pdf');
      try {
        console.log(`  📄 ${row.name} → ${dest}`);
        copyOneFile(row.fullPath, dest);
        copied++;
      } catch (e) { skipped++; errors.push(`${row.name}.pdf: ${e.message}`); }
    }
  }

  console.log(`\n📊 归档结果: 成功 ${copied}, 失败 ${skipped}`);
  return { copied, skipped, errors };
}

// ============ 主流程 ============

function normalizeOutput(outputPath) {
  const out = path.resolve(outputPath);
  const { root, dir, base } = path.parse(out);
  if (base === '' && dir === root) {
    const sub = path.join(out, '档案归档结果');
    console.log(`\n⚠️ 输出为磁盘根目录，已自动使用子目录: ${sub}`);
    return sub;
  }
  return out;
}

async function main() {
  const targetDir = process.argv[2];
  const outputDir = process.argv[3] || path.join(targetDir, '..', '归档结果');

  if (!targetDir) {
    console.log('用法: node archive-classifier.js <档案文件夹路径> [输出目录]');
    console.log('示例: node archive-classifier.js D:\\档案文件');
    console.log('       node archive-classifier.js D:\\档案文件 D:\\归档结果');
    process.exit(1);
  }

  const resolvedTarget = path.resolve(targetDir);
  const resolvedOutput = normalizeOutput(outputDir);

  if (!fs.existsSync(resolvedTarget)) {
    console.error(`错误: 路径不存在 - ${resolvedTarget}`);
    process.exit(1);
  }

  // ========== 扫描 ==========
  console.log(`\n📂 扫描目录: ${resolvedTarget}`);
  const files = scanPDFs(resolvedTarget);

  if (files.length === 0) {
    console.log('未找到 PDF 文件。');
    process.exit(0);
  }

  console.log(`找到 ${files.length} 个 PDF 文件\n`);

  // ========== 分析 ==========
  const header = '序号'.padEnd(5) + '文件名'.padEnd(40) + '页数'.padEnd(5) + '保管期限'.padEnd(8) + '大类'.padEnd(18) + '小类';
  console.log('='.repeat(100));
  console.log(header);
  console.log('='.repeat(100));

  const rows = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const name = path.basename(filePath, '.pdf');
    const stat = fs.statSync(filePath);

    // 显示进度
    process.stdout.write(`\r正在分析第 ${i + 1}/${files.length} 个文件...`);

    // 查找附件（与 PDF 同目录的非 PDF 文件）
    const attachments = findAttachments(filePath);

    // 提取全文
    const { text, pages } = await extractText(filePath);
    const contentForAnalysis = text || name;

    // 分类判断（大类 + 小类）
    const { category, subcategory } = classifyDocument(contentForAnalysis, name);
    const retention = determineRetention(contentForAnalysis, name);

    // 判断文件级别：正旺煤业→本级文，其余→上级文
    const upperText = text + name;
    const isUpper = !upperText.includes('正旺');

    // 日期
    const date = stat.mtime.toLocaleDateString('zh-CN');

    // 判断是否是扫描件
    const isScanned = !text || text.length < 20;

    rows.push({
      index: i + 1, name, pages, date, retention, category, subcategory, isUpper,
      fullPath: filePath, textPreview: text.substring(0, 100) || '(扫描件，无文本)',
      isScanned, attachments
    });

    const dispName = name.length > 32 ? name.substring(0, 29) + '...' : name;
    const scanned = isScanned ? ' 📷' : '';
    const hasFiles = attachments.length > 0 ? ' 📎' : '';
    const levelMark = isUpper ? ' ↑' : '';
    console.log('\r' + String(i + 1).padEnd(5) + dispName.padEnd(40) +
      String(pages).padEnd(5) + retention.label.padEnd(8) +
      `${category.code}`.padEnd(18) +
      `${subcategory.id} ${subcategory.name}${scanned}${hasFiles}${levelMark}`);
  }

  // 清除 pdfjs 引用，让 Worker 线程自然退出
  pdfjsCache = null;
  // 等一轮事件循环使 Worker 有机会清理
  await new Promise(resolve => setImmediate(resolve));

  console.log('\n' + '='.repeat(100));
  console.log(`\n✅ 共分析 ${rows.length} 个文件` +
    `（上级文 ${rows.filter(r => r.isUpper).length} 份，本级文 ${rows.filter(r => !r.isUpper).length} 份）`);

  // ========== 统计 ==========
  console.log('\n--- 分类统计 ---');
  const catCount = {}, retCount = {}, subCount = {};
  for (const r of rows) {
    catCount[r.category.code] = (catCount[r.category.code] || 0) + 1;
    retCount[r.retention.label] = (retCount[r.retention.label] || 0) + 1;
    if (r.category.code !== '?') {
      const key = r.category.code + '-' + r.subcategory.id;
      subCount[key] = (subCount[key] || 0) + 1;
    }
  }
  for (const [k, v] of Object.entries(catCount)) {
    const c = SUBCATEGORIES.find(c => c.code === k);
    console.log(`  ${k} ${c ? c.name : '未分类'}: ${v} 份`);
    // 显示该大类下的小类统计
    if (c) {
      for (const sub of c.subcategories) {
        const key = k + '-' + sub.id;
        const count = subCount[key] || 0;
        if (count > 0) console.log(`    ├─ ${sub.id} ${sub.name}: ${count} 份`);
      }
    }
  }
  console.log('\n--- 保管期限统计 ---');
  for (const [k, v] of Object.entries(retCount)) {
    console.log(`  ${k}: ${v} 份`);
  }

  // ========== CSV 导出（含正文摘要） ==========
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const csvPath = path.join(resolvedOutput, '档案分类结果.csv');
  const csvHeader = '序号,文件名,页数,生成日期,保管期限,分类代码,分类名称,小类代码,小类名称,文件级别,扫描件,附件数,正文摘要\n';
  const csvRows = rows.map(r =>
    `${r.index},"${r.name}",${r.pages},${r.date},${r.retention.label},${r.category.code},${r.category.name},${r.subcategory ? r.subcategory.id : '-'},${r.subcategory ? r.subcategory.name : '-'},${r.isUpper ? '上级文' : '本级文'},${r.isScanned ? '是' : '否'},${r.attachments ? r.attachments.length : 0},"${(r.textPreview || '').replace(/"/g, '""')}"`
  ).join('\n');
  fs.writeFileSync(csvPath, '﻿' + csvHeader + csvRows, 'utf-8');
  console.log(`\n📄 分类清单导出: ${csvPath}`);

  // ========== 创建归档目录 ==========
  console.log('\n📁 创建归档目录...');
  createArchiveStructure(resolvedOutput);

  // ========== 归档 ==========
  console.log('📋 归档文件中...');
  const result = organizeFiles(rows, resolvedOutput);
  console.log(`   已完成: ${result.copied} 个文件` +
    (result.skipped > 0 ? ` (${result.skipped} 个失败)` : ''));
  if (result.errors && result.errors.length > 0) {
    console.log('\n⚠️ 归档错误详情:');
    for (const err of result.errors.slice(0, 20)) {
      console.log(`  ${err}`);
    }
    if (result.errors.length > 20) console.log(`  ...还有 ${result.errors.length - 20} 个错误`);
  }

  console.log(`\n✅ 归档完成！`);
  console.log(`📂 输出目录: ${resolvedOutput}`);

  // ========== 显示归档文件清单 ==========
  console.log(`\n📋 归档文件清单:`);
  const catGroups = {};
  for (const r of rows) {
    if (r.category.code === '?') {
      if (!catGroups['未分类']) catGroups['未分类'] = [];
      catGroups['未分类'].push(r);
      continue;
    }
    const key = r.category.code + ' ' + r.category.name;
    if (!catGroups[key]) catGroups[key] = [];
    catGroups[key].push(r);
  }

  for (const [catKey, group] of Object.entries(catGroups)) {
    if (catKey === '未分类') {
      console.log(`\n  📁 未分类/`);
      for (const r of group) {
        console.log(`      📄 ${r.name}.pdf`);
      }
      continue;
    }

    // 按保管期限分组
    const retGroups = {};
    for (const r of group) {
      if (!retGroups[r.retention.label]) retGroups[r.retention.label] = [];
      retGroups[r.retention.label].push(r);
    }

    console.log(`\n  📁 ${catKey}/`);
    for (const [retLabel, retGroup] of Object.entries(retGroups)) {
      console.log(`      ├── ${retLabel}/`);

      // 按小类分组
      const subGroups = {};
      for (const r of retGroup) {
        if (!subGroups[r.subcategory.name]) subGroups[r.subcategory.name] = [];
        subGroups[r.subcategory.name].push(r);
      }

      for (const [subName, subGroup] of Object.entries(subGroups)) {
        console.log(`      │   ├── ${subName}/`);

        // 本级文和上级文分开显示
        const lower = subGroup.filter(r => !r.isUpper);
        const upper = subGroup.filter(r => r.isUpper);

        if (lower.length > 0) {
          console.log(`      │   │   ├── 本级文/`);
          for (const r of lower) {
            const attMark = r.attachments && r.attachments.length > 0 ? ` (含${r.attachments.length}个附件)` : '';
            console.log(`      │   │   │   ├── ${r.name}.pdf${attMark}`);
          }
        }
        if (upper.length > 0) {
          console.log(`      │   │   └── 上级文/`);
          for (const r of upper) {
            const attMark = r.attachments && r.attachments.length > 0 ? ` (含${r.attachments.length}个附件)` : '';
            console.log(`      │   │       ├── ${r.name}.pdf${attMark}`);
          }
        }
      }
    }
  }
  // 强制退出，避免 pdfjs Worker 线程残留导致崩溃（STATUS_ACCESS_VIOLATION）
  process.exit(0);
}

main().catch(e => { console.error('\n错误:', e.message); process.exit(1); });
