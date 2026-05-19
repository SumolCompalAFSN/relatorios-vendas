import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../lib/utils';

export interface EmailData {
  vendedor: string;
  ref3: string;
  docs: any[];
  destinatario: string;
  destinatarioGT: string;
  total?: number;
  tipo: 'ATRASO' | 'DIFERENÇA';
}

function formatDatePT(dateValue: any) {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);

  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

export function buildHtmlEmailAtrasos(data: EmailData) {
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : 'Boa tarde';
  
  const tableRows = data.docs.map(doc => {
    const dataVal = doc.data || doc.Data || doc['Data de lançamento'] || '';
    const dateStr = formatDatePT(dataVal);
    const docVal = doc.documento || doc.Documento || doc['Nº documento'] || '';
    const valorNum = doc.valor || doc.Valor || doc['Montante em moeda interna'] || 0;
    const textoVal = doc.texto || doc.Texto || '';

    return `
      <tr>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 12px; color: #334155; white-space: nowrap;">${dateStr}</td>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 12px; color: #334155; white-space: nowrap;">${docVal}</td>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 12px; text-align: center; color: #334155; white-space: nowrap;">${doc.diasUteis} dias</td>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 12px; font-weight: bold; text-align: right; color: #0f172a; white-space: nowrap;">${formatCurrency(valorNum)}</td>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 11px; color: #64748b; white-space: normal;">${textoVal}</td>
      </tr>
    `;
  }).join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #ffffff; text-align: left;">
        <div style="max-width: 650px; margin: 0;">
          <p style="margin: 0 0 20px 0; font-size: 14px;">${greeting} ${data.vendedor},</p>
          
          <p style="margin: 0 0 15px 0; font-size: 14px;">Segue abaixo o resumo dos recibos cujo depósito, tem um atraso de 2 ou mais dias:</p>
          
          <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 600;">Relembramos que a norma da empresa é depositar as cobranças no próprio dia, ou no limite, no dia seguinte de manhã.</p>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left">
                <table style="border-collapse: collapse; table-layout: auto; width: auto; margin: 0 0 25px 0; border: 1px solid #D9D9D9;">
                  <thead>
                    <tr style="background-color: #0A6ED1;">
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: left; font-size: 12px; color: #ffffff; font-weight: 600; white-space: nowrap;">Data</th>
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: left; font-size: 12px; color: #ffffff; font-weight: 600; white-space: nowrap;">Recibo</th>
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: center; font-size: 12px; color: #ffffff; font-weight: 600; white-space: nowrap;">Dias</th>
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: right; font-size: 12px; color: #ffffff; font-weight: 600; white-space: nowrap;">Valor</th>
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: left; font-size: 12px; color: #ffffff; font-weight: 600; white-space: normal;">Texto</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
              </td>
            </tr>
          </table>
          
          <p style="margin: 0 0 25px 0; font-size: 14px;">Solicitamos a regularização dos respetivos depósitos.</p>
          
          <div style="background-color: #f8fafc; padding: 12px 15px; border-radius: 4px; font-size: 13px; color: #475569; border: 1px solid #e2e8f0;">
            ➡️ Em caso de dúvidas, contacte: <a href="mailto:faturacao@sumolcompal.pt" style="color: #0A6ED1; text-decoration: none; font-weight: 600;">faturacao@sumolcompal.pt</a>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function buildHtmlEmailDiferencas(data: EmailData) {
  const tableRows = data.docs.map(doc => {
    const dataVal = doc.data || doc.Data || doc['Data de lançamento'] || '';
    const dateStr = formatDatePT(dataVal);
    const valorNum = doc.valor || doc.Valor || doc['Montante em moeda interna'] || 0;
    const textoVal = doc.texto || doc.Texto || '';

    return `
      <tr>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 12px; color: #334155; white-space: nowrap;">${dateStr}</td>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 12px; font-weight: bold; text-align: right; color: #0f172a; white-space: nowrap;">${formatCurrency(valorNum)}</td>
        <td style="border: 1px solid #D9D9D9; padding: 6px 8px; font-size: 11px; color: #64748b; white-space: normal;">${textoVal}</td>
      </tr>
    `;
  }).join('');

  const total = data.total || 0;
  const actionText = total > 0 ? 'Depositar' : 'Descontar';
  
  return `
    <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #ffffff; text-align: left;">
        <div style="max-width: 650px; margin: 0;">
          <p style="margin: 0 0 20px 0; font-size: 14px;">Boa tarde ${data.vendedor},</p>
          
          <p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 600;">Resumo de diferenças de depósito para a referência ${data.ref3}</p>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left">
                <table style="border-collapse: collapse; table-layout: auto; width: auto; margin: 0 0 15px 0; border: 1px solid #D9D9D9;">
                  <thead>
                    <tr style="background-color: #0A6ED1;">
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: left; font-size: 12px; color: #ffffff; font-weight: 600; white-space: nowrap;">Data</th>
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: right; font-size: 12px; color: #ffffff; font-weight: 600; white-space: nowrap;">Montante</th>
                      <th style="border: 1px solid #D9D9D9; padding: 8px; text-align: left; font-size: 12px; color: #ffffff; font-weight: 600; white-space: normal;">Texto</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                    <tr style="background-color: #f8fafc; font-weight: bold;">
                      <td style="border: 1px solid #D9D9D9; padding: 8px; font-size: 12px; color: #0f172a;">TOTAL</td>
                      <td style="border: 1px solid #D9D9D9; padding: 8px; font-size: 12px; text-align: right; color: #0f172a;">${formatCurrency(total)}</td>
                      <td style="border: 1px solid #D9D9D9; padding: 8px;"></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </table>
          
          <div style="margin: 0 0 30px 0;">
            <span style="background-color: #fef9c3; color: #854d0e; padding: 12px 18px; border-radius: 4px; display: inline-block; font-weight: bold; border: 1px solid #fde047; font-size: 14px;">
              ➡️ O que fazer: ${actionText} ${formatCurrency(Math.abs(total))} no próximo depósito
            </span>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 10px;">
            <p style="margin: 0 0 5px 0; font-size: 13px; color: #64748b;">Em caso de dúvidas, contacte: <a href="mailto:faturacao@sumolcompal.pt" style="color: #0A6ED1; text-decoration: none;">faturacao@sumolcompal.pt</a></p>
            <p style="margin: 0; font-size: 13px; color: #64748b;">Cumprimentos,<br><strong style="color: #1e293b;">Equipa AFSN</strong></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function generateAtrasosEML(data: EmailData) {
  return buildHtmlEmailAtrasos(data);
}

export function generateDiferencasEML(data: EmailData) {
  return buildHtmlEmailDiferencas(data);
}


export async function generatePDF(data: EmailData) {
  const doc = new jsPDF() as any;
  const isAtraso = data.tipo === 'ATRASO';
  
  doc.setFontSize(18);
  doc.setTextColor(10, 110, 209); // #0A6ED1
  doc.text(isAtraso ? 'Relatório de Atrasos nos Depósitos' : 'Relatório de Diferenças de Depósito', 14, 22);
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Vendedor: ${data.vendedor} (${data.ref3})`, 14, 32);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-PT')}`, 14, 39);

  const columns = isAtraso 
    ? ['Data', 'Recibo', 'Dias', 'Valor', 'Texto']
    : ['Data', 'Montante', 'Texto'];

  const rows = data.docs.map(d => {
    const dataVal = d.data || d.Data || d['Data de lançamento'] || '';
    const dateStr = formatDatePT(dataVal);
    const docVal = d.documento || d.Documento || d['Nº documento'] || '';
    const valorNum = d.valor || d.Valor || d['Montante em moeda interna'] || 0;
    const textoVal = d.texto || d.Texto || '';

    return isAtraso 
      ? [dateStr, docVal, `${d.diasUteis} dias`, formatCurrency(valorNum), textoVal]
      : [dateStr, formatCurrency(valorNum), textoVal];
  });

  if (!isAtraso) {
    rows.push(['TOTAL', formatCurrency(data.total || 0), '']);
  }

  autoTable(doc, {
    startY: 45,
    head: [columns],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [10, 110, 209] },
  });

  return doc.output('blob');
}
