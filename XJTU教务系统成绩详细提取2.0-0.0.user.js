// ==UserScript==
// @name         XJTU教务系统成绩详细提取2.0
// @namespace    http://tampermonkey.net/
// @description  提取西安交通大学新版教务系统隐藏的平时成绩、期中成绩等细项，适配深色界面
// @author       Gemini & Iroul
// @match        https://jwxt.xjtu.edu.cn/jwapp/sys/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================
    // 表格的核心识别ID，只有检测到这个ID才会显示按钮
    const TABLE_ID = "#tabledqxq-index-table";

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
            animation: fadeIn 0.5s;
        `;
        // 添加淡入动画样式
        const style = document.createElement('style');
        style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
        document.head.appendChild(style);

        btn.onmouseover = () => { btn.style.transform = "scale(1.05)"; };
        btn.onmouseout = () => { btn.style.transform = "scale(1)"; };
        btn.onclick = extractGrades;
        document.body.appendChild(btn);
    }

    // 核心提取函数
    function extractGrades() {
        const tbody = document.querySelector(TABLE_ID + " > tbody");

        if (!tbody) {
            alert("未找到成绩表格，请确保数据已加载！");
            return;
        }

        const rows = tbody.querySelectorAll("tr");
        if (rows.length === 0) {
            alert("当前表格没有数据，请先点击查询按钮获取成绩。");
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

    // 智能监听：只在发现成绩表时才显示按钮
    const observer = new MutationObserver((mutations) => {
        const tableExists = document.querySelector(TABLE_ID);
        const btnExists = document.getElementById('xjtu-grade-btn');

        if (tableExists && !btnExists) {
            createTriggerButton();
        } else if (!tableExists && btnExists) {
            // 如果切到了没有表格的页面（如培养方案），自动移除按钮
            btnExists.remove();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();