/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { 
  FileSpreadsheet, 
  Mail, 
  FileText, 
  Trash2, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  ExternalLink,
  Copy,
  LayoutDashboard,
  Clock,
  ArrowRightLeft,
  ChevronRight,
  User,
  History,
  TrendingUp,
  Import,
  FileArchive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

import { parseSAPFile } from './utils/sapParser';
import { calcularDiasUteis } from './utils/dateUtils';
import { EMAILS_DEFAULT, EmailConfig } from './data/emailsDefault';
import { getRef3, formatCurrency, cn, parseSAPValue } from './lib/utils';
import { buildHtmlEmailAtrasos, buildHtmlEmailDiferencas, generatePDF, EmailData } from './utils/emailUtils';
const NETWORK_PATH = "Y:/S+C/negocio/MP-GC/7. Serviço Cliente/Crédito, Cobrança e Facturação/Facturação/PFTD/RVV/ranking_atual.xlsx";
import rvvIcon from './assets/rvv-icon.png';


type Mode = 'ATRASO' | 'DIFERENCA';

interface GroupedData {
  ref3: string;
  vendedor: string;
  email: string;
  emailGT: string;
  docs: any[];
  total: number;
  enviado?: boolean;
}

// Helper to load emails correctly
function loadEmails(): Record<string, EmailConfig> {
  const stored = localStorage.getItem("emails_config");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Erro ao carregar emails do localStorage:", e);
    }
  }
  return EMAILS_DEFAULT;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('ATRASO');
  const [emails, setEmails] = useState<Record<string, EmailConfig>>(loadEmails());
  const [loading, setLoading] = useState(false);
  const [resultsAtraso, setResultsAtraso] = useState<GroupedData[]>([]);
  const [resultsDiferenca, setResultsDiferenca] = useState<GroupedData[]>([]);
  const [importModal, setImportModal] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>("");

useEffect(() => {
  const saved = localStorage.getItem("ranking_last_update");
  if (saved) setLastUpdate(saved);
}, []);

// 🔵 Carregar ranking do localStorage
useEffect(() => {
  const saved = localStorage.getItem("app_ranking");

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setRanking(parsed);
      }
    } catch (e) {
      console.error("Erro ao carregar ranking:", e);
    }
  } else {
    alert("⚠️ Não existe ranking guardado.\n\nPor favor importe o ficheiro Excel do ranking.");
  }
}, []);
  
// 🔥 ✅ NOVO — REPROCESSAR DADOS QUANDO EMAILS MUDAM
useEffect(() => {
  if (results.length === 0) return;

  const allData = results.flatMap(r => r.docs);
  processData(allData);

}, [emails]);


// 🔵 ✅ NOVA FUNÇÃO — ATUALIZAR RANKING
const atualizarRanking = (ref: string) => {
  if (!ref) return;

  const refStr = String(ref).padStart(3, "0"); // ✅ garante 009

  const copia = [...ranking];
  const index = copia.findIndex(r => r.ref === refStr);

  if (index >= 0) {
    copia[index].count += 1;
  } else {
    copia.push({ ref: refStr, count: 1 });
  }

  setRanking(copia);
  localStorage.setItem("app_ranking", JSON.stringify(copia));
};

// 🔵 Reset apenas do ranking
const handleResetRanking = () => {

  console.log("RESET RANKING ✅");

  localStorage.removeItem('app_ranking');
  setRanking([]);
};

// 🔵 Reset total
const handleResetAll = () => {
  if (confirm("Deseja limpar todos os dados? Esta ação é irreversível e apagará o histórico, e-mails e resultados atuais.")) {
    localStorage.clear();
    setResultsAtraso([]);
    setRanking([]);
    setEmails(EMAILS_DEFAULT);
    alert("Sistema restaurado para o estado inicial.");
  }
};

  const results = mode === 'ATRASO'
  ? resultsAtraso
  : resultsDiferenca;

const hasEmailsForAll =
  results.length > 0 &&
  results.every(item => emails[item.ref3]?.email);

// Right panel calculations
const allDocsForMetrics = results.flatMap(r => r.docs);

const totalDocsCount = allDocsForMetrics.length;

const avgDelay = totalDocsCount > 0 
  ? allDocsForMetrics.reduce((sum, d) => sum + (d.diasUteis || 0), 0) / totalDocsCount 
  : 0;

// ✅ maxDelay CORRETO (corrigido)
const maxDelay = totalDocsCount > 0 
  ? Math.max(...allDocsForMetrics.map(d => d.diasUteis || 0)) 
  : 0;

// ✅ vendedor com maior atraso (AGORA NO SÍTIO CERTO)
let maxDelayVendor: GroupedData | null = null;

if (mode === 'ATRASO' && results.length > 0) {
  results.forEach(item => {
    item.docs.forEach(doc => {
      if ((doc.diasUteis || 0) === maxDelay) {
        maxDelayVendor = item;
      }
    });
  });
}

// DIFERENÇAS Calculations
const maxDifferences = results.length > 0
  ? Math.max(...results.map(r => r.docs.length))
  : 0;

const avgValue = results.length > 0
  ? results.reduce((sum, r) => sum + r.total, 0) / results.length
  : 0;

const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync ranking from localStorage if it changes externally or on emails change (legacy sync)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

   
    
    // 🔥 TEMP: deixar passar tudo para testar
    if (mode === 'DIFERENCA') {
      console.log("MODO DIFERENÇA - FICHEIRO:", file.name);
    }


    setLoading(true);
    try {
      const parsedData = await parseSAPFile(file);
      console.log("📊 PARSED DATA:", parsedData);
      console.log("📊 TOTAL:", parsedData.length);
      
      if (parsedData.length > 0) {
        console.log("🔥 COLUNAS REAIS:", Object.keys(parsedData[0]));
      }

      processData(parsedData);
    } catch (err: any) {
  console.error("ERRO DETALHADO:", err);
  alert(`Erro ao processar ficheiro: ${err?.message || err}`);
} finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processData = (data: any[]) => {
    const today = new Date();
    
    // Filtro OBRIGATÓRIO: Apenas Tipo de documento = "ZD"
const zdData = data.filter(row =>
  String(row['Tipo de documento'] || '').toUpperCase() === 'ZD'
);
console.log("📊 Linhas ZD encontradas:", zdData.length);

// ✅ NOVO: filtro para Diferenças (SA)
const saData = data.filter(row =>
  String(row['Tipo de documento'] || '').toUpperCase() === 'SA'
);
console.log("📊 Linhas SA encontradas:", saData.length);

if (mode === 'ATRASO') {
  const filtered = zdData.filter(row => {
    const texto = String(row.texto || row['Texto'] || '').toUpperCase();
    if (texto === 'EM ANÁLISE') return false;
    if (texto.includes('PAG. TPA VENDEDOR')) return false;

    let dataLanc = row.data || row['Data de lançamento'];
    if (!dataLanc) return false;

    if (!(dataLanc instanceof Date)) {
      dataLanc = new Date(dataLanc);
    }

    if (isNaN(dataLanc.getTime())) return false;

    const dias = calcularDiasUteis(dataLanc, today);
    row.diasUteis = dias;
    return dias >= 2;
  });

  console.log("✅ FILTRADOS:", filtered.length);

  groupAndSet(filtered);

} else {
  console.log("👉 ENTROU EM DIFERENÇA");

  // ✅ USAR SA EM VEZ DE ZD
  groupAndSet(saData);
}
  };

  const groupAndSet = (data: any[]) => {
    const groups: Record<string, GroupedData> = {};

    data.forEach(row => {
      // 1. NORMALIZAÇÃO OBRIGATÓRIA
      let rawRef = row.referencia || row['Referência'] || '';
      let ref3 = getRef3(rawRef);
      
      if (ref3) {
        ref3 = String(ref3)
          .trim()
          .replace(/\D/g, "")
          .padStart(3, "0");
      }

      if (!ref3 || ref3 === "000") {
        console.warn("⚠️ Linha ignorada - Referência inválida ou nula:", rawRef);
        return;
      }

      // 2. DEBUG
      console.log("Ref3 normalizada:", ref3);
      console.log("Lookup final:", emails[ref3]);

      const emailMap = emails[ref3];

      const key = `${ref3}_${emailMap?.email || 'sem_email'}`;

      if (!groups[key]) {
        groups[key] = {
          ref3,
          vendedor: emailMap?.nome || ref3,
          email: emailMap?.email || '',
          emailGT: emailMap?.cc || '',
          docs: [],
          total: 0
        };
      }
      const val = parseSAPValue(row.valor || row['Montante em moeda interna'] || 0);
      groups[key].docs.push(row);
      groups[key].total += val;
    });

    
      const final = Object.values(groups).sort((a, b) => {

  const maxA = Math.max(...a.docs.map(d => d.diasUteis || 0));
  const maxB = Math.max(...b.docs.map(d => d.diasUteis || 0));

  if (maxB !== maxA) return maxB - maxA;

  return b.total - a.total; // desempate por valor
});

      if (mode === 'ATRASO') {
        setResultsAtraso(final);
      } else {
        setResultsDiferenca(final);
      }

  };

  const handleImportEmails = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // 2. EXTRAÇÃO BRUTA (SEM PARSING)
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ""
      });

      console.log("RAW ARRAY:", raw);
      
      if (!raw || raw.length < 2) {
        alert("O ficheiro Excel parece estar vazio ou não tem o formato esperado.");
        return;
      }

      const emailRecords: Record<string, EmailConfig> = {};
      const rows = raw.slice(1);

      rows.forEach(row => {
        // Coluna 0: Codigo_3_digitos
        let codigo = String(row[0] || "").replace(/\D/g, "").padStart(3, "0");
        if (!codigo || codigo === "000") return;

        const cleanEmail = (val: any) => String(val || '')
          .replace("mailto:", "")
          .replace("[", "")
          .replace("]", "")
          .trim();

        // Coluna 1: Email, Coluna 2: Email GT, Coluna 3: Nome Vendedor
        emailRecords[codigo] = {
          email: cleanEmail(row[1]),
          cc: cleanEmail(row[2]),
          nome: String(row[3] || '').trim()
        };
      });

      console.log("Parsed emails:", emailRecords);
      localStorage.setItem("emails_config", JSON.stringify(emailRecords));
      setEmails(emailRecords);
      

      alert(`${Object.keys(emailRecords).length} vendedores importados com sucesso!`);

    } catch (err: any) {
      console.error("Erro na leitura do Excel:", err);
      if (err.message && (err.message.includes("Encrypted file") || err.message.includes("EncryptionInfo"))) {
        alert("⚠️ Erro Crítico: O ficheiro parece estar protegido por palavra-passe ou encriptado.\n\nPor favor, guarde o ficheiro Excel SEM proteção (Password) antes de carregar.");
      } else {
        alert("Erro ao ler o ficheiro. Verifique se o ficheiro segue o formato correto (.xlsx).");
      }
    } finally {
      setImportModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const markAsSent = (item: GroupedData) => {
  console.log("Marcar como enviado:", item.ref3);

  if (mode === 'ATRASO') {
    setResultsAtraso(prev =>
      prev.map(r =>
        r.ref3 === item.ref3 && r.email === item.email
          ? { ...r, enviado: true }
          : r
      )
    );
  } else {
    setResultsDiferenca(prev =>
      prev.map(r =>
        r.ref3 === item.ref3 && r.email === item.email
          ? { ...r, enviado: true }
          : r
      )
    );
  }
};
  
  const generateEMLBlob = (item: GroupedData) => {
    const html = mode === 'ATRASO' ? buildHtmlEmailAtrasos({
      vendedor: item.vendedor,
      ref3: item.ref3,
      docs: item.docs,
      destinatario: item.email,
      destinatarioGT: item.emailGT,
      tipo: 'ATRASO'
    }) : buildHtmlEmailDiferencas({
      vendedor: item.vendedor,
      ref3: item.ref3,
      docs: item.docs,
      destinatario: item.email,
      destinatarioGT: item.emailGT,
      total: item.total,
      tipo: 'DIFERENÇA'
    });

    const subject = mode === 'ATRASO' 
        ? `Atrasos nos depósitos - V${item.ref3} ${item.vendedor}`
        : `Diferenças de depósito - V${item.ref3} ${item.vendedor}`;

    const boundary = "boundary__afsn_" + Date.now();
    const textPlain = `Bom dia,\n\nPor favor, veja o relatório detalhado no corpo do email HTML.\n\nVendedor: ${item.vendedor} (V${item.ref3})\nTotal: ${formatCurrency(item.total)}\n\nEquipa AFSN`;

    const emlLines = [
      `X-Unsent: 1`,
      `Subject: ${subject}`,
      `To: ${item.email}`,
      `Cc: ${item.emailGT}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      textPlain,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
      ``,
      `--${boundary}--`
    ];

    return new Blob([emlLines.join('\r\n')], { type: 'message/rfc822' });
  };

  const openEmail = (item: GroupedData) => {
    if (item.enviado) return;
    const blob = generateEMLBlob(item);
    // Download the EML file - opening it will trigger the default email client (Outlook)
    saveAs(blob, `DRAFT_V${item.ref3}_${item.vendedor.replace(/\s+/g, '_')}.eml`);
    markAsSent({ref3: item.ref3 || item.REF3,email: item.email});

  };

  const downloadEML = (item: GroupedData) => {
    const blob = generateEMLBlob(item);
    saveAs(blob, `${mode}_V${item.ref3}.eml`);
    markAsSent(item);
  };

  const downloadPDF = async (item: GroupedData) => {
    const blob = await generatePDF({
      vendedor: item.vendedor,
      ref3: item.ref3,
      docs: item.docs,
      destinatario: item.email,
      destinatarioGT: item.emailGT,
      total: item.total,
      tipo: mode === 'ATRASO' ? 'ATRASO' : 'DIFERENÇA'
    });
    saveAs(blob, `Relatorio_${mode}_V${item.ref3}.pdf`);
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();
    const data = mode === 'ATRASO' ? resultsAtraso : resultsDiferenca;

console.log("DEBUG RESULT 0:", data[0]);


data.forEach(item => {

  if (item.enviado) return; // ✅ CRÍTICO

  if (mode === 'ATRASO') {

    const ref = item.ref3.toString().padStart(3, "0");

    setRanking(prev => {
      const existing = prev.find(r => r.ref === ref);

      if (existing) {
        return prev.map(r =>
          r.ref === ref
            ? { ...r, count: r.count + 1 }
            : r
        );
      } else {
        return [...prev, { ref, count: 1 }];
      }
    });
  }

  markAsSent(item);
});
    
    // 1. Criar pastas no ZIP
    const pastaEmails = zip.folder("E-Mails");
    const pastaRelatorios = zip.folder("Relatórios");

    for (const item of results) {
      // 2. Gerar PDF
      const pdfBlob = await generatePDF({
        vendedor: item.vendedor,
        ref3: item.ref3,
        docs: item.docs,
        destinatario: item.email,
        destinatarioGT: item.emailGT,
        total: item.total,
        tipo: mode === 'ATRASO' ? 'ATRASO' : 'DIFERENÇA'
      });
      
      if (pastaRelatorios) {
        pastaRelatorios.file(`Relatorio_V${item.ref3}.pdf`, pdfBlob);
      }

      // 3. Gerar EML
      const emlBlob = generateEMLBlob(item);
      if (pastaEmails) {
        pastaEmails.file(`Email_V${item.ref3}.eml`, emlBlob);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Relatorios_Completos.zip`);
  };

  const exportRankingExcel = () => {
  if (ranking.length === 0) {
    alert("Não existem dados de ranking para exportar.");
    return;
  }

  const data = ranking.map(r => ({
    Codigo: r.ref,
    Contador: r.count
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ranking");

  const now = new Date();
  const fileName = `ranking_${now.toISOString().replace(/[:T]/g, '-').slice(0,16)}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};

  const handleImportRanking = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const imported = rows.map(row => ({
      ref: String(row.Codigo || "").padStart(3, "0"),
      count: Number(row.Contador || 0)
    }));

    setRanking(prev => {

  const merged = prev.map(r => ({ ...r })); // ✅ cópia segura

  imported.forEach(newItem => {
    const existing = merged.find(r => r.ref === newItem.ref);

    if (existing) {
      existing.count += newItem.count;
    } else {
      merged.push({ ...newItem }); // ✅ também copiar aqui
    }
  });

  localStorage.setItem("app_ranking", JSON.stringify(merged));

  return merged;
});

const now = new Date().toLocaleString();
localStorage.setItem("ranking_last_update", now);

alert("Ranking importado com sucesso!");
    
  } catch (err) {
    console.error(err);
    alert("Erro ao importar ranking.");
  }
};

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F6F7] text-[#333] font-sans">
      {/*  Style Header */}
      <header className="h-14 bg-[#0A6ED1] flex items-center justify-between px-6 shrink-0 shadow-md z-10">
        <div className="flex items-center space-x-4">
          <img src={rvvIcon} alt="RVV" className="w-10 h-10 object-contain" />
          
          <h1 className="text-white font-semibold text-lg tracking-tight italic flex items-center">
            RVV — Relatórios Valores Vendas 
            <span className="font-normal opacity-70 ml-2 text-xs not-italic border-l border-white/20 pl-2">v3.5.0</span>
          </h1>
        </div>
        
        <div className="flex items-center space-x-6 text-white text-sm">
          <div className="flex space-x-4 border-r border-white/20 pr-6">
            <button 
              onClick={() => { setMode('ATRASO'); setResults([]); }}
              className={cn(
                "opacity-90 hover:opacity-100 font-medium pb-1 transition-all",
                mode === 'ATRASO' ? "border-b-2 border-white opacity-100" : "opacity-60"
              )}
            >
              Atrasos
            </button>
            <button 
              onClick={() => { setMode('DIFERENCA'); setResults([]); }}
              className={cn(
                "opacity-90 hover:opacity-100 font-medium pb-1 transition-all",
                mode === 'DIFERENCA' ? "border-b-2 border-white opacity-100" : "opacity-60"
              )}
            >
              Diferenças
            </button>
            <button 
              onClick={() => setImportModal(true)}
              className="opacity-60 hover:opacity-100 font-medium pb-1 transition-all"
            >
              Carregar BD E-Mails
            </button>
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <span className="opacity-80 text-xs">Equipa AFSN</span>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-xs ring-1 ring-white/10">AF</div>
          </div>
        </div>
      </header>

      {/* Top Action Bar */}
      <div className="h-20 bg-white border-b border-gray-200 flex items-center px-6 justify-between shadow-sm shrink-0">
        <div className="flex items-center space-x-4">
          <label className="border-2 border-dashed border-[#0A6ED1]/40 bg-[#0A6ED1]/5 rounded px-4 py-2 flex items-center space-x-3 cursor-pointer hover:bg-[#0A6ED1]/10 transition-colors group">
             <FileSpreadsheet size={20} className="text-[#0A6ED1]" />
             <div>
               <p className="text-[10px] uppercase font-bold text-[#0A6ED1]">Carregar SAP</p>
               <p className="text-xs font-semibold text-slate-600">
                  {mode === 'ATRASO' ? 'export_atr.xlsx' : 'export_dif.xlsx'}
               </p>
             </div>
             <input type="file" className="hidden" accept=".xlsx,.xls,.html" onChange={handleFileChange} ref={fileInputRef} />
          </label>
        </div>
        
        <div className="flex space-x-2 items-center">

  {/* Export */}
  <button
    onClick={exportRankingExcel}
    className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700"
  >
    Exportar Ranking
  </button>

  {/* Import */}
  <label className="px-3 py-1.5 bg-gray-500 text-white text-xs font-bold rounded cursor-pointer hover:bg-gray-600">
    Importar Ranking
    <input
      type="file"
      accept=".xlsx"
      onChange={handleImportRanking}
      className="hidden"
    />
  </label>

</div>
      </div>

      {/* Content Layout */}
      <div className="flex grow overflow-hidden">
        {/* Sidebar Stats */}
        <aside className="w-[250px] bg-white border-r border-gray-200 p-4 space-y-6 overflow-y-auto hidden lg:block shrink-0">
          <div>
            <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-3 tracking-widest">Estatísticas Rápidas</h3>
            <div className="space-y-3">
              <div className="p-4 bg-[#F5F6F7] rounded-lg border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Montante Total</p>
                <p className={cn(
                  "text-xl font-bold px-1 rounded",
                  mode === 'DIFERENCA' ? "text-orange-600" : "text-[#0A6ED1]"
                )}>
                  {formatCurrency(results.reduce((acc, curr) => acc + curr.total, 0))}
                </p>
              </div>

              <div className="p-4 bg-[#F5F6F7] rounded-lg border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Nº Vendedores</p>
                <motion.p 
                  key={results.length}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-2xl font-bold text-slate-800"
                >
                  {results.length}
                </motion.p>
              </div>

             {mode === 'ATRASO' && (
  <div className="p-4 bg-[#F5F6F7] rounded-lg border border-gray-100 shadow-sm">
    <p className="text-xs text-gray-500 mb-1">Nº Recibos sem Depósito</p>
    <p className="text-2xl font-bold text-slate-800 tracking-tight">
      {totalDocsCount}
    </p>
  </div>
)}

<div className="p-4 bg-[#F5F6F7] rounded-lg border border-gray-100 shadow-sm">
  <p className="text-xs text-gray-500 mb-1">
    {mode === 'ATRASO' ? 'Maior Atraso' : 'Maior Nº de Diferenças'}
  </p>

  <p className="text-2xl font-bold text-red-600 tracking-tight">
    {mode === 'ATRASO' ? `${maxDelay} dias` : maxDifferences}
  </p>

  {/* ✅ NOVO — vendedor com maior atraso */}
  {mode === 'ATRASO' && maxDelayVendor && (
    <p className="text-[10px] text-slate-800 mt-1">
      {maxDelayVendor.ref3} - {maxDelayVendor.vendedor}
    </p>
  )}
</div>

<div className="p-4 bg-[#F5F6F7] rounded-lg border border-gray-100 shadow-sm">
  <p className="text-xs text-gray-500 mb-1">
    {mode === 'ATRASO' ? 'Média Atraso' : 'Média de Valor'}
  </p>

  <p className="text-2xl font-bold text-orange-600 tracking-tight">
    {mode === 'ATRASO' 
      ? `${avgDelay.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias` 
      : formatCurrency(avgValue)}
  </p>
</div>

            </div>
          </div>
          
          {results.length > 0 && (
            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-2 text-[#0A6ED1] mb-3">
                <CheckCircle2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0A6ED1]">Status de Envio</span>
              </div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">Progresso</span>
                <span className="font-bold text-slate-700">
                  {Math.round((results.filter(r => r.enviado).length / results.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden ring-1 ring-black/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(results.filter(r => r.enviado).length / results.length) * 100}%` }}
                  className="bg-[#0A6ED1] h-full transition-all duration-500 shadow-[0_0_8px_rgba(10,110,209,0.3)]" 
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-right italic font-medium">
                {results.filter(r => r.enviado).length} de {results.length} concluídos
              </p>
            </div>
          )}
        </aside>

        {/* Main Data List */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Grid Header */}
          <div className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 flex items-center px-6 py-2.5 sticky top-0 z-[5]">
            <div className="w-[60px]">Ref3</div>
            <div className="w-[280px]">Vendedor</div>
            <div className="w-[100px] text-center">Documentos</div>
            <div className="w-[120px] text-right">Valor Total</div>
            <div className="w-[180px] text-right pr-2 ml-auto flex flex-col items-end">
              <span>Ações Rápidas</span>
              {results.length > 0 && ( 
                 <button
  onClick={downloadAllZip}
  disabled={!hasEmailsForAll}
  title={
    hasEmailsForAll
      ? "Download ZIP"
      : "Existem vendedores sem email configurado"
  }
  className="mt-1 flex items-center space-x-1 px-3 py-1 bg-[#0A6ED1] hover:bg-blue-700 text-white text-[9px] font-bold rounded shadow-sm transition disabled:bg-gray-300 disabled:cursor-not-allowed"
>

                  <Download size={10} />
                  <span>Download ZIP ({results.length})</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Rows Container */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 scrollbar-thin">
            {loading && (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50/50">
                <div className="animate-spin text-[#0A6ED1] mb-2"><History size={24} /></div>
                <p className="text-xs font-bold text-[#0A6ED1] uppercase">Processando Arquivo SAP...</p>
              </div>
            )}
            
            {!loading && results.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FileSpreadsheet size={48} className="opacity-30 mb-4" />
                <p className="text-sm">Inicie o processamento carregando os ficheiros Excell.</p>
             </div>
            )}

            {!loading && results.map((item, idx) => (
              <motion.div 
                key={`${item.ref3}_${item.email}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                className={cn(
                  "flex items-center px-6 py-3 bg-white hover:bg-[#F5F6F7] border-b border-gray-100 transition-colors group",
                  item.enviado && "bg-gray-50/50"
                )}
              >
                {/* Ref3 */}
                <div className="w-[60px] font-mono text-xs text-[#0A6ED1] font-bold">{item.ref3}</div>
                
                {/* Vendedor Info */}
                <div className="w-[280px] min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate text-slate-800">
                      {emails[item.ref3] ? `${item.ref3} - ${emails[item.ref3].nome}` : item.ref3}
                    </p>
                    {item.enviado && (
                      <span className="bg-green-100 text-green-700 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center shrink-0">
                        <CheckCircle2 size={8} className="mr-1" /> Enviado
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5 italic">
                    {item.email || 'Email não configurado na base'}
                  </p>
                </div>

                {/* Docs Count */}
                <div className="w-[100px] text-center">
                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                     {item.docs.length} docs
                   </span>
                </div>

                {/* Total Value */}
                <div className="w-[120px] text-right">
                  <span className="text-xs font-bold font-mono text-slate-700">
                    {formatCurrency(item.total)}
                  </span>
                </div>

                {/* Actions */}
                <div className="w-[180px] flex justify-end space-x-2 pl-4 ml-auto">
                   <button 
                    onClick={() => downloadPDF(item)}
                    title="Descarregar PDF"
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-[10px] font-bold rounded hover:bg-gray-50 hover:text-[#0A6ED1] transition shadow-sm"
                   >
                    <Download size={14} />
                    PDF
                  </button>
                   <button
  onClick={() => {
  if (!emails[item.ref3]?.email) return;
  if (item.enviado) return;   // ✅ NOVO — BLOQUEIO

  if (mode === 'ATRASO') {
    atualizarRanking(item.ref3);
  }

  openEmail(item);
}}

  disabled={!emails[item.ref3]?.email || item.enviado}
  title={
    emails[item.ref3]?.email
      ? "Enviar email"
      : "Email não configurado"
  }
  className="px-3 py-1.5 bg-[#0A6ED1] text-white text-[10px] font-bold rounded shadow-sm hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
>
  Enviar E-Mail
</button>


                  
{/* ✅ NOVO — estado do email */}
  {emails[item.ref3]?.email ? (
  <CheckCircle2 size={16} className="text-green-500" />
) : (
  <AlertCircle size={16} className="text-red-500" />
)}


</div>

                  {!item.enviado && (
                    <button 
                      onClick={() => markAsSent(`${item.ref3}_${item.email}`)}
                      className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition border border-green-100"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  )}
              </motion.div>
            ))}
          </div>

          {/* Status Footer */}
          <footer className="h-8 bg-[#E2E6E9] border-t border-gray-300 flex items-center px-4 justify-between shrink-0 shadow-inner">
            <div className="flex items-center space-x-6 text-[10px] font-semibold text-gray-600">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 shadow-[0_0_4px_rgba(34,197,94,0.5)]"></span>
                SAP Parser: Ativo
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 shadow-[0_0_4px_rgba(10,110,209,0.5)]"></span>
                Holidays Data v1.2 (PT)
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-[#0A6ED1] rounded-full mr-2"></span>
                Vendedores: {Object.keys(emails).length}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 italic opacity-60">
              Sistema de Geração Automática AFSN - {new Date().getFullYear()}
            </div>
          </footer>
        </main>

        {/* Right Panel - Ranking */}
        {mode === 'ATRASO' && (
          <aside className="w-[250px] bg-white border-l border-gray-200 p-4 shrink-0 overflow-y-auto hidden xl:block">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
  <h3 className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
    Ranking de Atividade
  </h3>

  <span
    className="text-gray-400 text-xs cursor-help hover:text-[#0A6ED1]"
    title={`Pasta de rede: ${NETWORK_PATH}`}
  >
    ?
  </span>
</div>
                  {lastUpdate && (
  <div className="text-[10px] text-gray-400 mt-1 text-right">
    Última atualização: {lastUpdate}
  </div>
)}
                  <button 
                    onClick={handleResetRanking}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                    title="Resetar ranking de atividade"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <ul className="text-xs space-y-3">
                  {ranking.length === 0 && <li className="text-gray-400 italic">Sem dados...</li>}
                  {ranking.slice().sort((a, b) => b.count - a.count).map((s, idx) => {
                    const normalizedRef = String(s.ref).replace(/\D/g, "").padStart(3, "0");
                    const vendor = emails[normalizedRef];
                    const displayName = vendor ? `${normalizedRef} - ${vendor.nome}` : normalizedRef;
                    
                    return (
                      <li key={idx} className="flex justify-between items-center group">
                        <span className="text-gray-600 truncate mr-2 group-hover:text-[#0A6ED1] transition-colors">{displayName}</span>
                        <span className="font-bold bg-gray-100 px-2 py-0.5 rounded text-[10px]">{s.count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
          </aside>
        )}
      </div>

      {/* Settings Modal (Unchanged functionality, styled for theme) */}
      <AnimatePresence>
        {importModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white max-w-lg w-full rounded-xl shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Settings size={20} className="text-[#0A6ED1]" />
                  Painel de Carregamento de Emails
                </h3>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="bg-[#0A6ED1]/5 p-4 rounded-xl border border-[#0A6ED1]/10">
                  <div className="flex gap-4">
                    <div className="bg-[#0A6ED1] p-2 rounded-lg shrink-0 h-fit text-white">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Sincronização de Vendedores</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        A importação requer um Excel (<span className="font-mono">Template_Emails.xlsx</span>) com as colunas exatas: 
                        <br/><code className="bg-white/50 px-1 rounded border">Codigo_3_digitos</code>, 
                        <code className="bg-white/50 px-1 rounded border ml-1">Email</code>, 
                        <code className="bg-white/50 px-1 rounded border ml-1">Email GT</code>, 
                        <code className="bg-white/50 px-1 rounded border ml-1">Nome Vendedor</code>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Registos Locais</p>
                    <span className="text-[10px] font-mono text-[#0A6ED1] font-bold bg-blue-50 px-1.5 py-0.5 rounded">{Object.keys(emails).length} Entradas</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs font-mono max-h-40 overflow-y-auto scrollbar-thin">
                    <div className="grid grid-cols-2 gap-2 opacity-60">
                       {Object.entries(emails).slice(0, 10).map(([codigo, e], i) => (
                         <div key={i} className="truncate border-b border-gray-200 pb-1">{codigo}: {(e as EmailConfig).nome}</div>
                       ))}
                       {Object.keys(emails).length > 10 && <div className="col-span-2 text-center pt-1 italic opacity-40">...e {Object.keys(emails).length - 10} mais vendedores</div>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center justify-center gap-2 bg-[#0A6ED1] text-white p-3 rounded-lg cursor-pointer hover:bg-blue-700 transition font-bold text-xs shadow-md">
                    <Import size={16} />
                    Carregar Emails
                    <input type="file" className="hidden" accept=".xlsx" onChange={handleImportEmails} />
                  </label>
                  <button 
                    onClick={() => {
                      if(confirm("Deseja apagar todos os registos e resetar a base?")) {
                        localStorage.removeItem('emails_config');
                        setEmails({});
                        alert('Base limpa.');
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-500 p-3 rounded-lg hover:bg-gray-50 transition font-bold text-xs"
                  >
                    <History size={16} />
                    Reset Emails
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 flex justify-end">
                 <button 
                  onClick={() => setImportModal(false)} 
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-white shadow-sm transition"
                 >
                  Fechar
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
