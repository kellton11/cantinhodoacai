import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStore } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import { hashPassword } from '../lib/hash';
import { brl, fdt } from '../lib/format';
import { storageMode } from '../data';
import type { TabId, WeightUnit } from '../types';

interface Props {
  ensureAuth: () => Promise<boolean>;
  onPasswordSet: () => void;
}

const LOCKABLE: { id: TabId; label: string }[] = [
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'produtos', label: 'Produtos e preços' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'compras', label: 'O que comprar' },
];

export default function Produtos({ ensureAuth, onPasswordSet }: Props) {
  const { db, setSettings, addProduct, updateProduct, deleteProduct, runBackup, importBackup } = useStore();
  const ui = useUI();
  const st = db.settings;

  const [preco, setPreco] = useState(String(st.pricePerKg));
  const [custoKg, setCustoKg] = useState(String(st.acaiCostPerKg));
  const [acaiStock, setAcaiStock] = useState(st.acaiStockId ?? '');
  const [pNome, setPNome] = useState('');
  const [pPreco, setPPreco] = useState('');
  const [pCusto, setPCusto] = useState('');
  const [pEst, setPEst] = useState('');
  const [baud, setBaud] = useState(String(st.baud));
  const [unit, setUnit] = useState<WeightUnit>(st.unit);

  const stockOptions = (
    <>
      <option value="">— nenhum —</option>
      {db.stock.map((s) => (
        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
      ))}
    </>
  );

  async function salvarPreco() {
    await setSettings({ pricePerKg: parseFloat(preco) || 0, acaiCostPerKg: parseFloat(custoKg) || 0, acaiStockId: acaiStock || null });
    ui.toast('Salvo!');
  }

  async function addItem() {
    const price = parseFloat(pPreco);
    if (!pNome.trim() || !(price >= 0)) return ui.toast('Informe nome e preço.');
    await addProduct({ name: pNome.trim(), price, cost: parseFloat(pCusto) || 0, stockId: pEst || null });
    setPNome('');
    setPPreco('');
    setPCusto('');
  }

  async function removeItem(id: string) {
    if (await ui.confirm('Remover este produto?')) await deleteProduct(id);
  }

  async function salvarBalanca() {
    await setSettings({ baud: parseInt(baud, 10) || 9600, unit });
    ui.toast('Salvo! Se a balança já estava conectada, desconecte e conecte de novo.');
  }

  async function definirSenha() {
    if (st.passHash && !(await ensureAuth())) return;
    const p = await ui.askPassword(st.passHash ? 'Digite a nova senha' : 'Crie uma senha', true);
    if (!p) return;
    await setSettings({ passHash: await hashPassword(p) });
    onPasswordSet();
    ui.toast('Senha salva!');
  }

  async function removerSenha() {
    if (!(await ensureAuth())) return;
    if (await ui.confirm('Remover a senha? As abas ficarão abertas para qualquer pessoa.')) {
      await setSettings({ passHash: '', lockedTabs: [] });
    }
  }

  async function alternarAba(id: TabId, on: boolean) {
    if (!(await ensureAuth())) return;
    const set = new Set(st.lockedTabs);
    if (on) set.add(id);
    else set.delete(id);
    await setSettings({ lockedTabs: Array.from(set) });
  }

  async function exportar() {
    await runBackup();
    ui.toast('Backup baixado.');
  }

  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(await ui.confirm('Isso substitui TODOS os dados atuais. Continuar?'))) return;
    if (await importBackup(await file.text())) ui.toast('Backup restaurado!');
  }

  return (
    <>
      <div className="card">
        <h2>Açaí por peso</h2>
        <div className="row">
          <div>
            <label>Preço por kg (R$)</label>
            <input type="number" step="0.01" min="0" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>
          <div>
            <label>Custo por kg (R$)</label>
            <input type="number" step="0.01" min="0" value={custoKg} onChange={(e) => setCustoKg(e.target.value)} />
          </div>
          <div>
            <label>Baixar do estoque o item</label>
            <select value={acaiStock} onChange={(e) => setAcaiStock(e.target.value)}>{stockOptions}</select>
          </div>
          <button onClick={() => void salvarPreco()}>Salvar</button>
        </div>
        <p className="hint">O custo por kg é quanto você paga pelo açaí (incluindo o que vai junto no copo). Ele é usado para calcular o lucro.</p>
      </div>

      <div className="card">
        <h2>Itens com preço fixo</h2>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Nome</label>
            <input value={pNome} onChange={(e) => setPNome(e.target.value)} placeholder="ex.: Água 500ml" />
          </div>
          <div>
            <label>Preço (R$)</label>
            <input type="number" step="0.01" min="0" value={pPreco} onChange={(e) => setPPreco(e.target.value)} />
          </div>
          <div>
            <label>Custo (R$)</label>
            <input type="number" step="0.01" min="0" value={pCusto} onChange={(e) => setPCusto(e.target.value)} />
          </div>
          <div>
            <label>Baixa no estoque (opcional)</label>
            <select value={pEst} onChange={(e) => setPEst(e.target.value)}>{stockOptions}</select>
          </div>
          <button onClick={() => void addItem()}>Adicionar</button>
        </div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Item</th><th className="r">Preço</th><th className="r">Custo</th><th className="r">Margem</th><th>Estoque</th><th></th></tr>
          </thead>
          <tbody>
            {db.products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="r">
                  <input
                    key={p.id + ':p:' + p.price}
                    style={{ width: 90, textAlign: 'right' }}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v >= 0 && v !== p.price) void updateProduct(p.id, { price: v });
                    }}
                  />
                </td>
                <td className="r">
                  <input
                    key={p.id + ':c:' + p.cost}
                    style={{ width: 90, textAlign: 'right' }}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={p.cost}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      if (v !== p.cost) void updateProduct(p.id, { cost: v });
                    }}
                  />
                </td>
                <td className="r">{p.cost > 0 && p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) + '%' : '-'}</td>
                <td>{db.stock.find((s) => s.id === p.stockId)?.name ?? '-'}</td>
                <td><button className="x" onClick={() => void removeItem(p.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Você pode corrigir o preço e o custo direto na tabela. Sem custo, o lucro desse item aparece maior que o real.</p>
      </div>

      <div className="card">
        <h2>Configuração da balança</h2>
        <div className="row">
          <div>
            <label>Velocidade (baud rate)</label>
            <select value={baud} onChange={(e) => setBaud(e.target.value)}>
              {[9600, 4800, 2400, 19200, 38400, 115200].map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label>A balança envia o peso em</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)}>
              <option value="kg">kg (ex.: 0.350)</option>
              <option value="g">gramas (ex.: 350)</option>
            </select>
          </div>
          <button onClick={() => void salvarBalanca()}>Salvar</button>
        </div>
        <p className="hint">Se o peso aparecer errado depois de conectar, ajuste a velocidade ou a unidade aqui. Use o navegador Chrome ou Edge.</p>
      </div>

      <div className="card">
        <h2>🔒 Senha</h2>
        <div className="row">
          <button onClick={() => void definirSenha()}>{st.passHash ? 'Alterar senha' : 'Definir senha'}</button>
          {st.passHash && <button className="sec" onClick={() => void removerSenha()}>Remover senha</button>}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Abas protegidas por senha (o Caixa fica sempre livre):</p>
        <div>
          {LOCKABLE.map((t) => (
            <label key={t.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 16 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={st.lockedTabs.includes(t.id)}
                onChange={(e) => void alternarAba(t.id, e.target.checked)}
              />
              {t.label}
            </label>
          ))}
        </div>
        <p className="hint">Anote a senha em um lugar seguro. Depois de desbloquear, use o botão “Bloquear” no topo ao terminar.</p>
      </div>

      <div className="card">
        <h2>Cópia de segurança</h2>
        <div className="row">
          <button className="sec" onClick={() => void exportar()}>⬇ Baixar backup dos dados</button>
          <label className="btn sec" style={{ textAlign: 'center', margin: 0, cursor: 'pointer' }}>
            ⬆ Restaurar backup
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => void importar(e)} />
          </label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 15, color: 'inherit' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={st.autoBackup}
            onChange={(e) => void setSettings({ autoBackup: e.target.checked })}
          />
          Baixar um backup automaticamente ao fechar o caixa
        </label>
        <p className="hint">
          Último backup: {st.lastBackupAt ? fdt(st.lastBackupAt) : 'nunca'}. O arquivo vai para a pasta Downloads do navegador.
          Se o Chrome perguntar, permita os downloads deste site.
        </p>
        <p className="hint">
          {storageMode === 'supabase'
            ? 'Os dados ficam no Supabase. Também dá para restaurar aqui o backup do arquivo HTML antigo.'
            : 'Os dados ficam salvos neste navegador. Baixe o backup de vez em quando. Aceita também o backup do arquivo HTML antigo.'}
        </p>
      </div>
    </>
  );
}
