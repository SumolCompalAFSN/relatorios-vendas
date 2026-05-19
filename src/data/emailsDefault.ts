export interface EmailConfig {
  email: string;
  cc: string;
  nome: string;
}

export const EMAILS_DEFAULT: Record<string, EmailConfig> = {
  "063": {
    email: "vendedor063@exemplo.pt",
    cc: "gestor063@exemplo.pt",
    nome: "Vendedor Teste 063"
  },
  "100": {
    email: "vendedor100@exemplo.pt",
    cc: "gestor100@exemplo.pt",
    nome: "Vendedor Teste 100"
  }
};
