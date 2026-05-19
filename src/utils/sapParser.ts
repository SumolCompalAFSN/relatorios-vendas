import * as XLSX from 'xlsx';

/**
 * Normaliza as chaves do objeto para facilitar o acesso independente da variação do SAP
 */
function normalizeHeaders(row: any) {
  const newRow: any = {};
  Object.keys(row).forEach(key => {
    const normalizedKey = key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    // Mantemos as originais mas injetamos normalizadas para o código interno
    if (normalizedKey.includes("data de lancamento") || normalizedKey === "data") newRow.data = row[key];
    if (normalizedKey.includes("documento")) newRow.documento = row[key];
    if (normalizedKey.includes("referencia")) newRow.referencia = row[key];
    if (normalizedKey.includes("montante") || normalizedKey === "valor") newRow.valor = row[key];
    if (normalizedKey.includes("texto")) newRow.texto = row[key];
    
    newRow[key] = row[key];
  });
  return newRow;
}

export async function parseSAPFile(file: File): Promise<any[]> {
  console.log("📂 Ficheiro:", file.name);
  console.log("📏 Tamanho:", (file.size / 1024).toFixed(2), "KB");

  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    console.log("💾 ArrayBuffer pronto, tamanho:", data.length);

    let workbook;
    try {
      workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
        raw: false
      });
    } catch (err: any) {
      if (err.message && (err.message.includes("Encrypted file") || err.message.includes("EncryptionInfo"))) {
        console.error("❌ Erro de Encriptação detectado:", err.message);
      }
      console.warn("❌ XLSX failed, trying Text/HTML fallback...");
      return tryParseTextFallback(file);
    }

    const sheetName = workbook.SheetNames.find(name => {
      const ws = workbook.Sheets[name];
      return ws && ws['!ref'];
    }) || workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet['!ref']) return tryParseTextFallback(file);

    // Ajuste de range (SAP costuma ter 5 linhas de cabeçalho lixo)
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    if (range.e.r > 5) {
      range.s.r = 4; // Começar na linha 5 (index 4)
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
      blankrows: false
    });

    if (jsonData.length === 0) {
      console.warn("⚠️ JSON vazio, tentando fallback...");
      return tryParseTextFallback(file);
    }

    const normalizedData = jsonData.map(normalizeHeaders);
    console.log("✅ Linhas extraídas:", normalizedData.length);
    console.log("🔍 Primeira linha:", normalizedData[0]);

    return normalizedData;
  } catch (error) {
    console.error("🔥 Erro no Parse:", error);
    return tryParseTextFallback(file);
  }
}

async function tryParseTextFallback(file: File): Promise<any[]> {
  console.log("🔁 Ativando FALLBACK de texto...");
  const text = await file.text();
  
  if (!text || text.trim().length === 0) {
    throw new Error("O ficheiro parece estar vazio.");
  }

  // Se for HTML (comum no SAP)
  if (text.includes("<table")) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const table = doc.querySelector('table');
    if (table) {
      const rows = Array.from(table.querySelectorAll('tr'));
      const tableData = rows.map(tr => Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent?.trim() || ''));
      
      let headerIndex = tableData.findIndex(row => 
        row.some(cell => ["Data", "Referência", "Documento", "Montante"].some(k => cell.includes(k)))
      );
      if (headerIndex === -1) headerIndex = Math.min(tableData.length - 1, 5);
      
      const headers = tableData[headerIndex];
      const data = tableData.slice(headerIndex + 1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
        return normalizeHeaders(obj);
      });
      console.log("✅ HTML fallback extraiu:", data.length);
      return data;
    }
  }

  // Fallback para Tab-Separated (comum no SAP exported as XLS)
  const lines = text.split('\n').filter(l => l.trim() !== "");
  if (lines.length > 5) {
    const separator = text.includes('\t') ? '\t' : (text.includes(';') ? ';' : ',');
    const rows = lines.map(l => l.split(separator).map(c => c.trim()));
    
    // Tentar achar o header
    let headerIdx = rows.findIndex(r => r.some(c => ["Data", "Referencia", "Montante"].some(k => c.includes(k))));
    if (headerIdx === -1) headerIdx = 5;

    const headers = rows[headerIdx];
    const data = rows.slice(headerIdx + 1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
        return normalizeHeaders(obj);
    });
    console.log("✅ Text fallback extraiu:", data.length);
    return data;
  }

  throw new Error("Não foi possível ler o ficheiro. Verifique o formato.");
}
