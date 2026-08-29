import { Injectable } from '@angular/core';

import { formatDisplayDate, formatLongDisplayDate } from '../../../../shared/utils/local-date.util';

export interface EmployeePrintData {
  fullName: string;
  employeeNumber: string;
  employeeTypeCode: string;
  ruleSystemCode: string;
  statusLabel: string;
  isActive: boolean;
  company: string | null;
  workCenter: string | null;
  hireDate: string | null;
  contractTypeName: string | null;
  contractSubtypeName: string | null;
  contractCode: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractIsActive: boolean;
  email: string | null;
  phone: string | null;
}

@Injectable({ providedIn: 'root' })
export class EmployeePdfService {
  print(data: EmployeePrintData): void {
    const html = this.buildHtml(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
        win.addEventListener('afterprint', () => {
          win.close();
          URL.revokeObjectURL(url);
        });
      });
    } else {
      URL.revokeObjectURL(url);
    }
  }

  private buildHtml(d: EmployeePrintData): string {
    const today = formatLongDisplayDate(new Date());
    const initials = this.initials(d.fullName);
    const yearsOfService = this.computeYears(d.hireDate);
    const isActive = d.isActive;

    const accentColor = isActive ? '#4f46e5' : '#64748b';
    const statusBg = isActive ? '#dcfce7' : '#f1f5f9';
    const statusColor = isActive ? '#15803d' : '#475569';
    const statusBorder = isActive ? '#86efac' : '#cbd5e1';
    const heroBg = isActive
      ? 'linear-gradient(135deg, #3730a3 0%, #4f46e5 45%, #4f46e5 100%)'
      : 'linear-gradient(135deg, #334155 0%, #475569 45%, #64748b 100%)';

    const fmtDate = (iso: string | null) => (iso ? formatDisplayDate(iso) : '—');

    const val = (v: string | null | undefined) => this.esc(v?.trim() || '—');

    const contractPeriod = (() => {
      if (!d.contractStartDate) return '—';
      const start = fmtDate(d.contractStartDate);
      if (d.contractEndDate) return `${start} – ${fmtDate(d.contractEndDate)}`;
      return d.contractIsActive ? `${start} · En vigor` : start;
    })();

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ficha de empleado — ${this.esc(d.fullName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      color: #1e3a54;
      background: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ─── PAGE WRAPPER ─── */
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    /* ─── HERO BAND ─── */
    .hero {
      background: ${heroBg};
      padding: 2rem 2.4rem 0;
      position: relative;
      overflow: hidden;
    }

    /* Decorative circles */
    .hero::before {
      content: '';
      position: absolute;
      top: -3rem; right: -3rem;
      width: 14rem; height: 14rem;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      pointer-events: none;
    }
    .hero::after {
      content: '';
      position: absolute;
      top: 1rem; right: 4rem;
      width: 6rem; height: 6rem;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      pointer-events: none;
    }

    .hero-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.6rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.56rem;
    }
    .brand-mark {
      width: 1.8rem; height: 1.8rem;
      border-radius: 0.36rem;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.35);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6rem; font-weight: 800; color: #fff;
      letter-spacing: -0.02em;
    }
    .brand-name {
      font-size: 0.88rem;
      font-weight: 800;
      color: rgba(255,255,255,0.9);
      letter-spacing: -0.01em;
    }

    .doc-label {
      font-size: 0.64rem;
      font-weight: 600;
      color: rgba(255,255,255,0.55);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* ─── EMPLOYEE IDENTITY ─── */
    .identity {
      display: flex;
      align-items: flex-end;
      gap: 1.2rem;
      position: relative;
      z-index: 1;
    }

    .avatar {
      width: 4.4rem; height: 4.4rem;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      border: 2.5px solid rgba(255,255,255,0.35);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; font-weight: 800; color: #fff;
      flex-shrink: 0;
      letter-spacing: -0.04em;
      margin-bottom: 0.1rem;
    }

    .identity-copy { flex: 1; min-width: 0; padding-bottom: 0.2rem; }

    .identity-name {
      font-size: 1.6rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 0.32rem;
    }

    .identity-chips {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      border-radius: 999px;
      font-size: 0.64rem;
      font-weight: 600;
      padding: 0.18rem 0.56rem;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.24);
      color: rgba(255,255,255,0.85);
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      font-size: 0.64rem;
      font-weight: 700;
      line-height: 1;
      padding: 0.22rem 0.64rem;
      background: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusBorder};
      letter-spacing: 0.02em;
    }

    /* ─── METRICS STRIP ─── */
    .metrics-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: rgba(255,255,255,0.08);
      border-top: 1px solid rgba(255,255,255,0.12);
      margin-top: 1.4rem;
    }

    .metric {
      padding: 0.72rem 1rem;
      border-right: 1px solid rgba(255,255,255,0.1);
    }
    .metric:last-child { border-right: 0; }

    .metric-label {
      font-size: 0.56rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.5);
      margin-bottom: 0.18rem;
    }

    .metric-value {
      font-size: 0.84rem;
      font-weight: 700;
      color: rgba(255,255,255,0.92);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metric-value--empty {
      color: rgba(255,255,255,0.35);
      font-weight: 400;
    }

    /* ─── BODY ─── */
    .body {
      flex: 1;
      padding: 1.6rem 2.4rem 1.4rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.2rem 1.6rem;
      align-content: start;
    }

    .section {
      break-inside: avoid;
    }

    .section--full {
      grid-column: 1 / -1;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.62rem;
    }

    .section-icon {
      width: 1.1rem; height: 1.1rem;
      border-radius: 0.28rem;
      background: ${accentColor};
      display: flex; align-items: center; justify-content: center;
      font-size: 0.52rem;
      color: #fff;
      flex-shrink: 0;
    }

    .section-title {
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${accentColor};
    }

    .section-divider {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, rgba(79,70,229,0.2), transparent);
    }

    .fields {
      display: grid;
      gap: 0.52rem;
    }

    .field {
      display: grid;
      gap: 0.1rem;
    }

    .field dt {
      font-size: 0.58rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #8097ab;
    }

    .field dd {
      font-size: 0.84rem;
      font-weight: 600;
      color: #162f42;
      line-height: 1.3;
    }

    .field dd.empty {
      color: #b0c4d4;
      font-weight: 400;
    }

    /* Contract badge */
    .contract-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 0.3rem;
      font-size: 0.58rem;
      font-weight: 700;
      padding: 0.14rem 0.42rem;
      background: rgba(79,70,229,0.1);
      color: ${accentColor};
      border: 1px solid rgba(79,70,229,0.2);
      margin-left: 0.36rem;
      vertical-align: middle;
    }

    /* Tenure badge */
    .tenure {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      font-size: 0.6rem;
      font-weight: 700;
      padding: 0.16rem 0.5rem;
      background: rgba(79,70,229,0.08);
      color: ${accentColor};
      border: 1px solid rgba(79,70,229,0.15);
      margin-left: 0.4rem;
    }

    /* ─── NOTES AREA ─── */
    .notes-box {
      border: 1px dashed rgba(79,70,229,0.2);
      border-radius: 0.5rem;
      background: rgba(79,70,229,0.02);
      padding: 0.6rem 0.8rem;
      min-height: 2.4rem;
    }

    .notes-placeholder {
      font-size: 0.72rem;
      color: #b0c4d4;
      font-style: italic;
    }

    /* ─── FOOTER ─── */
    .footer {
      padding: 0.6rem 2.4rem;
      background: #f8fafc;
      border-top: 1px solid #e8eef4;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 0.36rem;
      font-size: 0.6rem;
      font-weight: 700;
      color: #8097ab;
    }

    .footer-dot {
      width: 0.2rem; height: 0.2rem;
      border-radius: 50%;
      background: #b0c4d4;
    }

    .footer-meta {
      font-size: 0.6rem;
      color: #b0c4d4;
    }

    .confidential {
      font-size: 0.58rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #dba640;
      border: 1px solid #f0d080;
      border-radius: 0.22rem;
      padding: 0.1rem 0.36rem;
      background: #fffbeb;
    }

    /* ─── PRINT ─── */
    @media print {
      body { background: #fff; }
      .page { width: 100%; margin: 0; box-shadow: none; }
      @page { margin: 0; size: A4; }
    }

    @media screen {
      body { padding: 1.5rem 0 2rem; }
      .page {
        box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08);
        border-radius: 0.5rem;
        overflow: hidden;
      }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ─── HERO ─── -->
  <div class="hero">
    <div class="hero-top">
      <div class="brand">
        <div class="brand-mark">B4</div>
        <span class="brand-name">B4RRHH</span>
      </div>
      <span class="doc-label">Ficha de empleado</span>
    </div>

    <div class="identity">
      <div class="avatar">${this.esc(initials)}</div>
      <div class="identity-copy">
        <div class="identity-name">${this.esc(d.fullName)}</div>
        <div class="identity-chips">
          <span class="chip">N&ordm;&nbsp;${this.esc(d.employeeNumber)}</span>
          <span class="chip">${this.esc(d.employeeTypeCode)}</span>
          <span class="chip">${this.esc(d.ruleSystemCode)}</span>
          <span class="status-pill">${this.esc(d.statusLabel)}</span>
        </div>
      </div>
    </div>

    <div class="metrics-strip">
      <div class="metric">
        <div class="metric-label">Empresa</div>
        <div class="metric-value ${d.company ? '' : 'metric-value--empty'}">${val(d.company)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Centro de trabajo</div>
        <div class="metric-value ${d.workCenter ? '' : 'metric-value--empty'}">${val(d.workCenter)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Fecha de alta</div>
        <div class="metric-value ${d.hireDate ? '' : 'metric-value--empty'}">${this.esc(fmtDate(d.hireDate))}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Antig&uuml;edad</div>
        <div class="metric-value ${yearsOfService !== null ? '' : 'metric-value--empty'}">${yearsOfService !== null ? this.esc(this.formatTenure(yearsOfService)) : '—'}</div>
      </div>
    </div>
  </div>

  <!-- ─── BODY ─── -->
  <div class="body">

    <!-- Identidad -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">&#9679;</div>
        <span class="section-title">Identidad funcional</span>
        <div class="section-divider"></div>
      </div>
      <dl class="fields">
        <div class="field">
          <dt>Nombre completo</dt>
          <dd>${this.esc(d.fullName)}</dd>
        </div>
        <div class="field">
          <dt>N&ordm; de empleado</dt>
          <dd>${this.esc(d.employeeNumber)}</dd>
        </div>
        <div class="field">
          <dt>Tipo de empleado</dt>
          <dd>${this.esc(d.employeeTypeCode)}</dd>
        </div>
        <div class="field">
          <dt>Sistema de reglas</dt>
          <dd>${this.esc(d.ruleSystemCode)}</dd>
        </div>
      </dl>
    </div>

    <!-- Situación laboral -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">&#9632;</div>
        <span class="section-title">Situaci&oacute;n laboral</span>
        <div class="section-divider"></div>
      </div>
      <dl class="fields">
        <div class="field">
          <dt>Empresa</dt>
          <dd class="${d.company ? '' : 'empty'}">${val(d.company)}</dd>
        </div>
        <div class="field">
          <dt>Centro de trabajo</dt>
          <dd class="${d.workCenter ? '' : 'empty'}">${val(d.workCenter)}</dd>
        </div>
        <div class="field">
          <dt>Fecha de alta</dt>
          <dd class="${d.hireDate ? '' : 'empty'}">
            ${this.esc(fmtDate(d.hireDate))}
            ${yearsOfService !== null ? `<span class="tenure">${this.esc(this.formatTenure(yearsOfService))}</span>` : ''}
          </dd>
        </div>
        <div class="field">
          <dt>Estado</dt>
          <dd><span class="status-pill">${this.esc(d.statusLabel)}</span></dd>
        </div>
      </dl>
    </div>

    <!-- Contrato activo -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">&#9650;</div>
        <span class="section-title">Contrato activo</span>
        <div class="section-divider"></div>
      </div>
      <dl class="fields">
        <div class="field">
          <dt>Tipo de contrato</dt>
          <dd class="${d.contractTypeName || d.contractCode ? '' : 'empty'}">
            ${val(d.contractTypeName ?? d.contractCode)}
            ${d.contractIsActive ? '<span class="contract-badge">Vigente</span>' : ''}
          </dd>
        </div>
        ${d.contractSubtypeName ? `<div class="field"><dt>Subtipo</dt><dd>${this.esc(d.contractSubtypeName)}</dd></div>` : ''}
        <div class="field">
          <dt>Per&iacute;odo</dt>
          <dd class="${d.contractStartDate ? '' : 'empty'}">${this.esc(contractPeriod)}</dd>
        </div>
      </dl>
    </div>

    <!-- Contacto -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">&#9670;</div>
        <span class="section-title">Contacto</span>
        <div class="section-divider"></div>
      </div>
      <dl class="fields">
        <div class="field">
          <dt>Correo electr&oacute;nico</dt>
          <dd class="${d.email ? '' : 'empty'}">${val(d.email)}</dd>
        </div>
        <div class="field">
          <dt>Tel&eacute;fono</dt>
          <dd class="${d.phone ? '' : 'empty'}">${val(d.phone)}</dd>
        </div>
      </dl>
    </div>

    <!-- Notas / espacio libre -->
    <div class="section section--full">
      <div class="section-header">
        <div class="section-icon">&#8942;</div>
        <span class="section-title">Observaciones</span>
        <div class="section-divider"></div>
      </div>
      <div class="notes-box">
        <span class="notes-placeholder">Sin observaciones registradas.</span>
      </div>
    </div>

  </div>

  <!-- ─── FOOTER ─── -->
  <div class="footer">
    <div class="footer-brand">
      B4RRHH
      <div class="footer-dot"></div>
      Sistema de Recursos Humanos
    </div>
    <span class="confidential">Confidencial</span>
    <span class="footer-meta">Generado el ${this.esc(today)}</span>
  </div>

</div>
</body>
</html>`;
  }

  private initials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (!parts[0]) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  private computeYears(hireDate: string | null): number | null {
    if (!hireDate) return null;
    const start = new Date(hireDate);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    const ms = now.getTime() - start.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
  }

  private formatTenure(years: number): string {
    if (years < 1) return 'Menos de 1 año';
    if (years === 1) return '1 año';
    return `${years} años`;
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
