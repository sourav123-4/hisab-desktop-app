import { store } from '../store.js';
import Papa from 'papaparse';
import type { Transaction } from '../../types/index.js';

export function renderCsvImporterModal(): void {
  let modal = document.getElementById('csvImporterModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'csvImporterModal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 680px;">
      <div class="modal-header">
        <h3 style="display: flex; align-items: center; gap: 8px;">
          <span>📄 Bank CSV Statement Importer</span>
        </h3>
        <button class="close-btn" id="closeCsvModalBtn">&times;</button>
      </div>

      <div style="padding: 10px 0;">
        <div id="csvUploadStep">
          <div id="csvDropZone" style="border: 2px dashed var(--border-color); border-radius: 16px; padding: 32px 20px; text-align: center; background: rgba(0,0,0,0.1); cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 40px; margin-bottom: 8px;">📑</div>
            <h4 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0;">
              Click or Drag & Drop Bank CSV File Here
            </h4>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 12px 0;">
              Supports HDFC, SBI, ICICI, Axis, Paytm, and standard CSV statements
            </p>
            <button class="btn btn-secondary btn-sm" id="csvBrowseBtn">Browse Computer</button>
            <input type="file" id="csvFileInput" accept=".csv, .txt" style="display: none;" />
          </div>
        </div>

        <div id="csvMappingStep" style="display: none;">
          <h4 style="font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin: 0 0 12px 0;">
            🛠️ Map CSV Columns to Daily Hisab Fields
          </h4>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Date Column *</label>
              <select id="csvColDate" class="form-control"></select>
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Title / Description *</label>
              <select id="csvColTitle" class="form-control"></select>
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">Amount Column *</label>
              <select id="csvColAmount" class="form-control"></select>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">Parsed Preview (<span id="csvParsedCount">0</span> transactions ready):</div>
            <div id="csvDuplicateSummary" style="font-size: 11.5px; color: var(--accent-warning); margin-bottom: 6px;"></div>
            <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.15);">
              <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.04);">
                    <th style="padding: 6px 10px;">Date</th>
                    <th style="padding: 6px 10px;">Description</th>
                    <th style="padding: 6px 10px;">Amount (₹)</th>
                    <th style="padding: 6px 10px;">Type</th>
                    <th style="padding: 6px 10px;">Import</th>
                  </tr>
                </thead>
                <tbody id="csvPreviewTableBody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" id="closeCsvModalBtn2">Cancel</button>
        <button class="btn btn-primary" id="importCsvSubmitBtn" style="display: none;">✨ Import Selected Transactions</button>
      </div>
    </div>
  `;

  modal.classList.add('active');

  let rawCsvText = '';
  let csvHeaders: string[] = [];
  let csvRows: string[][] = [];
  let parsedEntries: Partial<Transaction>[] = [];
  let duplicateIndexes = new Set<number>();

  const closeModal = () => modal?.classList.remove('active');
  (document.getElementById('closeCsvModalBtn') as HTMLElement).onclick = closeModal;
  (document.getElementById('closeCsvModalBtn2') as HTMLElement).onclick = closeModal;

  const dropZone = document.getElementById('csvDropZone') as HTMLElement;
  const browseBtn = document.getElementById('csvBrowseBtn') as HTMLElement;
  const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;

  browseBtn.onclick = () => fileInput.click();
  dropZone.onclick = (e: any) => { if (e.target !== browseBtn) fileInput.click(); };

  fileInput.onchange = (e: any) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      rawCsvText = evt.target.result;
      processCsvContent(rawCsvText);
    };
    reader.readAsText(file);
  };

  const processCsvContent = (text: string) => {
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: true
    });
    const rows = parsed.data.filter(row => Array.isArray(row) && row.some(cell => String(cell || '').trim()));
    if (rows.length < 2) {
      alert('CSV file is empty or invalid.');
      return;
    }

    csvHeaders = rows[0].map(h => String(h || '').trim());
    csvRows = rows.slice(1).map(row => row.map(cell => String(cell || '').trim())).filter(r => r.length >= csvHeaders.length);

    (document.getElementById('csvUploadStep') as HTMLElement).style.display = 'none';
    (document.getElementById('csvMappingStep') as HTMLElement).style.display = 'block';
    (document.getElementById('importCsvSubmitBtn') as HTMLElement).style.display = 'inline-flex';

    const populateSelect = (selectId: string, defaultPattern: RegExp) => {
      const select = document.getElementById(selectId) as HTMLSelectElement;
      select.innerHTML = csvHeaders.map((h, i) => `<option value="${i}">${h}</option>`).join('');
      const matchedIdx = csvHeaders.findIndex(h => defaultPattern.test(h.toLowerCase()));
      if (matchedIdx >= 0) select.value = String(matchedIdx);
    };

    populateSelect('csvColDate', /date|txn date|transaction date/);
    populateSelect('csvColTitle', /title|desc|narrative|particulars|remark|details/);
    populateSelect('csvColAmount', /amount|val|debit|credit|net/);

    const updatePreview = () => {
      const dateIdx = parseInt((document.getElementById('csvColDate') as HTMLSelectElement).value);
      const titleIdx = parseInt((document.getElementById('csvColTitle') as HTMLSelectElement).value);
      const amountIdx = parseInt((document.getElementById('csvColAmount') as HTMLSelectElement).value);

      parsedEntries = [];
      duplicateIndexes = new Set<number>();
      csvRows.forEach(row => {
        const rawDate = row[dateIdx] || new Date().toISOString().split('T')[0];
        const title = row[titleIdx] || 'Imported Entry';
        let rawAmount = (row[amountIdx] || '0').replace(/[^0-9.-]/g, '');
        let amount = Math.abs(parseFloat(rawAmount) || 0);

        if (amount > 0) {
          const isIncome = /credit|salary|refund|deposit/i.test(title) || parseFloat(rawAmount) > 0;
          const entry: Partial<Transaction> = {
            date: sanitizeDate(rawDate),
            title: title,
            amount: amount,
            type: isIncome ? 'income' : 'expense',
            category: isIncome ? 'Income' : autoCategorize(title),
            paymentMethod: 'NetBanking'
          };
          if (store.findDuplicateTransactions(entry).length > 0) {
            duplicateIndexes.add(parsedEntries.length);
          }
          parsedEntries.push(entry);
        }
      });

      const countEl = document.getElementById('csvParsedCount');
      const importableCount = parsedEntries.length - duplicateIndexes.size;
      if (countEl) countEl.textContent = String(importableCount);
      const duplicateSummary = document.getElementById('csvDuplicateSummary');
      if (duplicateSummary) {
        duplicateSummary.textContent = duplicateIndexes.size > 0
          ? `${duplicateIndexes.size} likely duplicate ${duplicateIndexes.size === 1 ? 'entry was' : 'entries were'} found and unchecked automatically.`
          : '';
      }
      const tbody = document.getElementById('csvPreviewTableBody');
      if (tbody) {
        tbody.innerHTML = parsedEntries.map((entry, idx) => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 6px 10px;">${entry.date}</td>
            <td style="padding: 6px 10px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entry.title}</td>
            <td style="padding: 6px 10px; font-weight: 700;">₹${entry.amount}</td>
            <td style="padding: 6px 10px; color: ${entry.type === 'income' ? 'var(--accent-success)' : 'var(--text-primary)'};">${entry.type}</td>
            <td style="padding: 6px 10px;">
              <input type="checkbox" class="csv-import-check" data-index="${idx}" ${duplicateIndexes.has(idx) ? '' : 'checked'} title="${duplicateIndexes.has(idx) ? 'Likely duplicate' : 'Ready to import'}">
            </td>
          </tr>
        `).join('');
      }
    };

    (document.getElementById('csvColDate') as HTMLElement).onchange = updatePreview;
    (document.getElementById('csvColTitle') as HTMLElement).onchange = updatePreview;
    (document.getElementById('csvColAmount') as HTMLElement).onchange = updatePreview;
    updatePreview();
  };

  const submitBtn = document.getElementById('importCsvSubmitBtn');
  if (submitBtn) {
    submitBtn.onclick = () => {
      const checkedIndexes = Array.from(document.querySelectorAll<HTMLInputElement>('.csv-import-check'))
        .filter(input => input.checked)
        .map(input => parseInt(input.dataset.index || '-1', 10))
        .filter(idx => idx >= 0);
      const entriesToImport = checkedIndexes.length > 0
        ? checkedIndexes.map(idx => parsedEntries[idx]).filter(Boolean)
        : parsedEntries.filter((_, idx) => !duplicateIndexes.has(idx));

      if (entriesToImport.length === 0) {
        alert('No valid entries to import.');
        return;
      }
      entriesToImport.forEach(entry => store.addTransaction(entry));
      alert(`✅ Successfully imported ${entriesToImport.length} transactions!${duplicateIndexes.size > 0 ? ` Skipped ${duplicateIndexes.size} likely duplicate(s).` : ''}`);
      closeModal();
    };
  }
}

function sanitizeDate(rawDate: string): string {
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return new Date().toISOString().split('T')[0];
}

function autoCategorize(title: string): string {
  const text = title.toLowerCase();
  if (/swiggy|zomato|restaurant|food|grocery|blinkit|zepto|bigbasket/i.test(text)) return 'Food';
  if (/electricity|bill|wifi|airtel|jio|gas|recharge|utility/i.test(text)) return 'Bills';
  if (/petrol|fuel|uber|ola|cab|auto|bus|flight|train|metro|transport|fastag/i.test(text)) return 'Transport';
  if (/amazon|flipkart|myntra|shopping|mall/i.test(text)) return 'Shopping';
  if (/pharmacy|hospital|doctor|medical|apollo/i.test(text)) return 'Health';
  if (/netflix|spotify|prime|movie|cinema/i.test(text)) return 'Entertainment';
  return 'Others';
}
