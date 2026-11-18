export interface Col {
  label: string;
  x: number;
  w?: number;
  right?: boolean;
}

export interface Row {
  v: string[];
  alert?: boolean;
}

/** Desenha uma tabela em uma imagem PNG (devolve o endereço da imagem). */
export function makeImage(title: string, subtitle: string, cols: Col[], rows: Row[], emptyMsg: string): string {
  const W = 900;
  const pad = 40;
  const rh = 46;
  const headH = 150;
  const colsH = 50;
  const H = headH + colsH + Math.max(rows.length, 1) * rh + 80;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) return '';

  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#4a1a6b');
  g.addColorStop(1, '#6b2d94');
  x.fillStyle = g;
  x.fillRect(0, 0, W, headH);
  x.fillStyle = '#fff';
  x.font = 'bold 30px Arial';
  x.fillText('🍇 Cantinho do Açaí', pad, 55);
  x.font = 'bold 40px Arial';
  x.fillText(title, pad, 105);
  x.font = '20px Arial';
  x.fillStyle = '#e8d8f5';
  x.fillText(subtitle, pad, 134);

  let y = headH + colsH - 14;
  x.fillStyle = '#6b6475';
  x.font = 'bold 18px Arial';
  cols.forEach((cl) => {
    x.textAlign = cl.right ? 'right' : 'left';
    x.fillText(cl.label.toUpperCase(), cl.right ? cl.x : pad + cl.x, y);
  });
  x.strokeStyle = '#6b2d94';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(pad, y + 10);
  x.lineTo(W - pad, y + 10);
  x.stroke();
  y += rh;

  if (!rows.length) {
    x.textAlign = 'left';
    x.fillStyle = '#6b6475';
    x.font = '24px Arial';
    x.fillText(emptyMsg, pad, y);
  }
  rows.forEach((r, i) => {
    if (i % 2 === 0) {
      x.fillStyle = '#f5eefb';
      x.fillRect(pad - 10, y - 32, W - 2 * pad + 20, rh);
    }
    cols.forEach((cl, j) => {
      x.textAlign = cl.right ? 'right' : 'left';
      x.fillStyle = r.alert && j === 1 ? '#d0383f' : '#2a1f33';
      x.font = (j === 0 ? 'bold ' : '') + '24px Arial';
      let t = String(r.v[j] ?? '');
      const maxW = cl.w ?? 400;
      while (x.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2);
      x.fillText(t, cl.right ? cl.x : pad + cl.x, y);
    });
    y += rh;
  });
  x.textAlign = 'left';
  x.fillStyle = '#6b6475';
  x.font = '18px Arial';
  x.fillText('Gerado em ' + new Date().toLocaleString('pt-BR'), pad, H - 28);
  return c.toDataURL('image/png');
}
