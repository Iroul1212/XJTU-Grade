// ==UserScript==
// @name         XJTU教务系统成绩详细提取2.0
// @namespace    http://tampermonkey.net/
// @description  提取西安交通大学Ehall教务系统隐藏的平时成绩、期中成绩等细项，适配深色界面
// @author       Gemini & Iroul
// @match        https://ehall.xjtu.edu.cn/jwapp/sys/cjcx/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================
    const columns = [
        { index: 0,  name: "学期",          show: "学期" },
        { index: 1,  name: "课程代码",      show: "课程代码" },
        { index: 2,  name: "课程名",        show: "课程名" },
        { index: 7,  name: "学分",          show: "学分" },
        { index: 11, name: "总成绩",        show: "总成绩" },
        { index: 33, name: "平时成绩",      show: "平时成绩" },
        { index: 34, name: "期末成绩",      show: "期末成绩" },
        { index: 35, name: "期中成绩",      show: "期中成绩" },
        { index: 36, name: "SYCJ_DISPLAY",  show: "实验成绩" },
        { index: 31, name: "QTCJ1_DISPLAY", show: "其他1" },
        { index: 27, name: "QTCJ2_DISPLAY", show: "其他2" },
    ];
    // ===========================================

    // 创建悬浮操作按钮
    function createTriggerButton() {
        if(document.getElementById('xjtu-grade-btn')) return;

        const btn = document.createElement("button");
        btn.id = 'xjtu-grade-btn';
        btn.innerHTML = "📊 提取详细成绩";
        btn.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 50px;
            z-index: 99999;
            padding: 10px 20px;
            background: #005eb8; /* 西交蓝 */
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            font-weight: bold;
            font-size: 14px;
            transition: all 0.3s;
        `;
        btn.onmouseover = () => { btn.style.transform = "scale(1.05)"; };
        btn.onmouseout = () => { btn.style.transform = "scale(1)"; };
        btn.onclick = extractGrades;
        document.body.appendChild(btn);
    }

    // 核心提取函数
    function extractGrades() {
        // 尝试获取表格主体
        const tbody = document.querySelector("#tabledqxq-index-table > tbody");

        if (!tbody) {
            // 在新系统中，如果 DOM ID 发生变化，此处会触发提示
            alert("未找到成绩表格 (ID: #tabledqxq-index-table)。\n如果已加载成绩但仍提示此错误，说明新系统修改了表格结构，需要更新选择器。");
            return;
        }

        const rows = tbody.querySelectorAll("tr");
        if (rows.length === 0) {
            alert("当前表格没有数据，请先查询出成绩列表。");
            return;
        }

        // 生成深色模式表格样式
        let tableHtml = `
            <div style="font-family: 'Microsoft YaHei', sans-serif; position: relative;">
                <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin:0; color: #fff;">详细成绩单 (XJTU)</h3>
                    <button id="close-grade-table" style="background: #ff4d4d; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">关闭</button>
                </div>
                <div style="max-height: 600px; overflow-y: auto; border: 1px solid #444;">
                    <table border="1" style="width: 100%; border-collapse: collapse; font-size: 13px; color: #eee; text-align: center;">
                        <thead>
                            <tr style="background: #2c2c2c; position: sticky; top: 0; z-index: 10;">
                                ${columns.map(col => `<th style="padding: 10px; border: 1px solid #444; min-width: 60px;">${col.show}</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>
        `;

        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            tableHtml += "<tr style='background: #1e1e1e; transition: background 0.2s;' onmouseover=\"this.style.background='#333'\" onmouseout=\"this.style.background='#1e1e1e'\">";

            columns.forEach(col => {
                const td = tds[col.index];
                let value = "-";
                if (td) {
                    // 优先获取 span 的 title 属性（通常隐藏的成绩在这里），其次是 innerText
                    const spanTitle = td.querySelector("span")?.title;
                    const innerText = td.innerText.trim();
                    value = spanTitle ? spanTitle : innerText;
                }
                tableHtml += `<td style="padding: 8px; border: 1px solid #444;">${value || "-"}</td>`;
            });

            tableHtml += "</tr>";
        });

        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const existingTable = document.getElementById("extracted-grade-table");
        if (existingTable) existingTable.remove();

        const div = document.createElement("div");
        div.id = "extracted-grade-table";
        div.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            background: #121212;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9);
            border: 1px solid #333;
            min-width: 900px;
            max-width: 95vw;
        `;
        div.innerHTML = tableHtml;
        document.body.appendChild(div);

        document.getElementById("close-grade-table").onclick = function() { div.remove(); };
    }

    const observer = new MutationObserver((mutations) => {
        if (!document.getElementById('xjtu-grade-btn')) {
            createTriggerButton();
        }
    });

    // 观察 document.body 的变化，适用于 SPA 动态加载
    observer.observe(document.body, { childList: true, subtree: true });

    // 初始延迟尝试
    setTimeout(createTriggerButton, 1500);

})();