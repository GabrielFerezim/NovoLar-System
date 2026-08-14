import React, { useState } from 'react';
import {
  Users,
  Plus,
  Check,
  X,
  Search,
  FileText,
  CreditCard,
  DollarSign,
  Calendar,
  AlertTriangle,
  Phone,
  Briefcase,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  MapPin,
  MessageCircle,
  Printer,
  Edit2,
  Trash2,
  Filter,
  Clock,
  CheckCircle2,
  Receipt
} from 'lucide-react';

export function generateWhatsAppFiadoLink(account, debtSummary = null) {
  if (!account || !account.phone) return null;
  const cleanPhone = account.phone.replace(/\D/g, '');
  if (!cleanPhone) return null;
  const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

  const balance = account.balance || 0;
  const formattedBalance = `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  let dueDateText = '';
  if (debtSummary && debtSummary.dueDate) {
    dueDateText = `\n📅 *Vencimento:* ${new Date(debtSummary.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;
  }

  let itemsText = '';
  if (debtSummary && debtSummary.items && debtSummary.items.length > 0) {
    itemsText = `\n📦 *Últimos Itens:* ${debtSummary.items.map(i => `${i.quantity}x ${i.name}`).slice(0, 4).join(', ')}`;
  }

  const message = `Olá *${account.name}*, tudo bem? 👋\n\nPassando para compartilhar o extrato atualizado da sua conta a prazo na *Novo Lar Materiais para Construção* 🏗️:\n\n💰 *Saldo Devedor Atual:* ${formattedBalance}${dueDateText}${itemsText}\n\nCaso já tenha realizado o pagamento, por favor desconsidere esta mensagem. Se precisar da chave PIX ou tiver qualquer dúvida, estamos à disposição!\n\n_Novo Lar Materiais para Construção_`;

  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

// Modal de Checkout Fiado no PDV
export function FiadoCheckoutModal({ creditAccounts, onConfirm, onClose, onCreateAccount }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Pedreiro');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBalance, setNewBalance] = useState('');

  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const filteredAccounts = creditAccounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (acc.role && acc.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    const account = {
      name: newName.trim(),
      role: newRole,
      phone: newPhone.trim(),
      address: newAddress.trim(),
      balance: parseFloat(newBalance.replace(',', '.')) || 0
    };
    onCreateAccount(account);
    setIsCreating(false);
    setSearchTerm(newName);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewBalance('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '500px', overflow: 'hidden' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: 'var(--text-primary)' }}>
            <Users size={22} style={{ color: 'var(--primary)' }} /> Selecionar Conta de Fiado
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} className="hover-item"><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedAccount ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>{selectedAccount.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {selectedAccount.role} {selectedAccount.phone ? `• ${selectedAccount.phone}` : ''}
                </div>
                {selectedAccount.address && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {selectedAccount.address}
                  </div>
                )}
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saldo atual acumulado:</span>
                  <span style={{ fontWeight: '800', color: selectedAccount.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    R$ {selectedAccount.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Data Limite para Pagamento (Vencimento)</label>
                <input 
                  type="date" 
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setSelectedAccount(null)}>Voltar</button>
                <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={() => onConfirm(selectedAccount.id, dueDate)}>Confirmar Venda</button>
              </div>
            </div>
          ) : isCreating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cadastre um novo cliente ou pedreiro para marcar a venda a prazo.</div>
              
              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Nome Completo *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João da Silva Santos" required autoFocus />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '13px' }}>Tipo / Função</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="Pedreiro">Pedreiro</option>
                    <option value="Empreiteiro">Empreiteiro</option>
                    <option value="Mestre de Obras">Mestre de Obras</option>
                    <option value="Cliente Físico">Cliente Físico</option>
                    <option value="Empresa">Empresa / Obra</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '13px' }}>Telefone / WhatsApp</label>
                  <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ex: (11) 98888-7777" />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Endereço Residencial / Comercial</label>
                <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Ex: Rua das Flores, 123 - Centro" />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Saldo Anterior Pendente (R$ - se houver)</label>
                <input type="text" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="0,00" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setIsCreating(false)}>Voltar à lista</button>
                <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleCreate} disabled={!newName.trim()}>Salvar e Selecionar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <Search className="input-icon" size={18} style={{ left: '16px' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Pesquisar cliente ou função..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  style={{ paddingLeft: '44px' }} 
                  autoFocus
                />
              </div>
              
              <div style={{ 
                maxHeight: '260px', 
                overflowY: 'auto', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: 'var(--bg-secondary)',
                padding: '4px'
              }} className="custom-scrollbar">
                {filteredAccounts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px', fontSize: '13px' }}>
                    Nenhum cliente cadastrado com este nome.
                  </div>
                ) : (
                  filteredAccounts.map(acc => (
                    <div 
                      key={acc.id} 
                      onClick={() => setSelectedAccount(acc)} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '12px 16px', 
                        borderBottom: '1px solid var(--border-color)', 
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background-color 0.2s'
                      }} 
                      className="search-item-hover"
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{acc.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <span>{acc.role}</span>
                          {acc.phone && <span>• {acc.phone}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', fontSize: '14px', color: acc.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Saldo atual</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button className="btn-secondary" style={{ padding: '12px', flex: 1 }} onClick={onClose}>Cancelar</button>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', flex: 1 }} onClick={() => setIsCreating(true)}>
                  <PlusCircle size={16} /> Novo Cadastro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal para Impressão do Extrato / Recibo de Débito Fiado
export function FiadoStatementPrintModal({ account, onClose }) {
  if (!account) return null;

  const todayStr = new Date().toLocaleDateString('pt-BR');
  const charges = (account.history || []).filter(t => t.type === 'charge');
  const payments = (account.history || []).filter(t => t.type === 'payment');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '16px' }}>
            <Printer size={18} style={{ color: 'var(--primary)' }} />
            Extrato & Comprovante de Débito
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          {/* Folha Imprimível */}
          <div className="printable-statement" style={{ backgroundColor: '#fff', color: '#111', padding: '24px', borderRadius: '8px', border: '1px solid #ccc', fontFamily: 'monospace, sans-serif' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #333', paddingBottom: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>NOVO LAR MATERIAIS</div>
              <div style={{ fontSize: '12px', color: '#444' }}>Para Construção & Acabamentos</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>EXTRATO DE CONTA A PRAZO / FIADO</div>
              <div style={{ fontSize: '11px', color: '#666' }}>Emissão: {todayStr} às {new Date().toLocaleTimeString('pt-BR')}</div>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '12px', lineHeight: '1.6' }}>
              <div><strong>Cliente:</strong> {account.name}</div>
              <div><strong>Tipo/Função:</strong> {account.role || 'Cliente'}</div>
              {account.phone && <div><strong>Contato:</strong> {account.phone}</div>}
              {account.address && <div><strong>Endereço:</strong> {account.address}</div>}
            </div>

            <div style={{ borderTop: '1px dashed #444', borderBottom: '1px dashed #444', padding: '8px 0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                <span>SALDO TOTAL PENDENTE:</span>
                <span style={{ color: '#b91c1c' }}>R$ {(account.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase' }}>Histórico de Compras e Baixas:</div>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                    <th style={{ padding: '4px 0' }}>Data</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(account.history || []).slice(-10).map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dotted #eee' }}>
                      <td style={{ padding: '4px 0' }}>{new Date(t.timestamp).toLocaleDateString('pt-BR')}</td>
                      <td>{t.description} {t.dueDate ? `(Venc: ${new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')})` : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {t.type === 'charge' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #333', textAlign: 'center', fontSize: '11px' }}>
              <div style={{ width: '80%', margin: '0 auto', borderTop: '1px solid #000', paddingTop: '4px' }}>
                Assinatura do Responsável / Devedor
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                Declaro estar ciente e de acordo com o saldo e compras acima listadas.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button className="btn-secondary" onClick={onClose}>Fechar</button>
            <button className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={16} /> Imprimir Extrato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tela Principal: Contas Fiado / Marcados
export function CreditAccountsView({
  creditAccounts,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddTransaction,
  onViewReceipt
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('debtors'); // 'all', 'debtors', 'overdue', 'paid'
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  // Modal de Baixa / Pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [paymentInstallments, setPaymentInstallments] = useState('1x');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Modal de Criação / Edição Direta
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('Pedreiro');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBalance, setFormBalance] = useState('');

  // Modal de Impressão de Extrato
  const [printStatementAccount, setPrintStatementAccount] = useState(null);

  const selectedAccount = creditAccounts.find(acc => acc.id === selectedAccountId);

  // Auxiliares de vencimento
  const getAccountDebtSummary = (account) => {
    if (!account.history || account.balance <= 0) return null;
    const charges = account.history.filter(t => t.type === 'charge' && t.dueDate);
    if (charges.length === 0) return null;
    const sorted = charges.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const latestCharge = charges[charges.length - 1];
    return {
      dueDate: sorted[0].dueDate,
      items: latestCharge.items || []
    };
  };

  const isAccountOverdue = (account) => {
    const summary = getAccountDebtSummary(account);
    if (!summary || !summary.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return summary.dueDate < today && account.balance > 0;
  };

  // Filtros
  const filteredAccounts = creditAccounts.filter(acc => {
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (acc.role && acc.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (acc.phone && acc.phone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterType === 'debtors') return acc.balance > 0;
    if (filterType === 'overdue') return isAccountOverdue(acc);
    if (filterType === 'paid') return acc.balance <= 0;
    return true; // 'all'
  });

  // Métricas
  const totalCredit = creditAccounts.reduce((sum, acc) => sum + (acc.balance > 0 ? acc.balance : 0), 0);
  const activeDebtors = creditAccounts.filter(acc => acc.balance > 0).length;
  const overdueAccounts = creditAccounts.filter(acc => isAccountOverdue(acc)).length;

  const handleOpenCreateModal = () => {
    setEditingAccountId(null);
    setFormName('');
    setFormRole('Pedreiro');
    setFormPhone('');
    setFormAddress('');
    setFormBalance('');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (acc, e) => {
    if (e) e.stopPropagation();
    setEditingAccountId(acc.id);
    setFormName(acc.name);
    setFormRole(acc.role || 'Pedreiro');
    setFormPhone(acc.phone || '');
    setFormAddress(acc.address || '');
    setFormBalance(acc.balance ? String(acc.balance) : '0');
    setIsFormModalOpen(true);
  };

  const handleSaveForm = () => {
    if (!formName.trim()) return;
    const accountData = {
      id: editingAccountId || undefined,
      name: formName.trim(),
      role: formRole,
      phone: formPhone.trim(),
      address: formAddress.trim(),
      balance: parseFloat(formBalance.replace(',', '.')) || 0
    };

    if (editingAccountId && onUpdateAccount) {
      onUpdateAccount(accountData);
    } else {
      onCreateAccount(accountData);
    }
    setIsFormModalOpen(false);
  };

  const handleDeleteAccount = (acc, e) => {
    if (e) e.stopPropagation();
    if (acc.balance > 0) {
      if (!confirm(`Atenção: Este cliente ainda possui um saldo devedor de R$ ${acc.balance.toFixed(2)}. Deseja realmente excluir este cadastro?`)) {
        return;
      }
    } else {
      if (!confirm(`Deseja excluir o cadastro de "${acc.name}"?`)) {
        return;
      }
    }
    if (onDeleteAccount) {
      onDeleteAccount(acc.id);
    }
    if (selectedAccountId === acc.id) {
      setSelectedAccountId(null);
    }
  };

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (!amount || amount <= 0) {
      alert('Digite um valor de pagamento válido.');
      return;
    }
    
    const finalMethod = paymentMethod === 'Cartão Crédito'
      ? `Cartão Crédito (${paymentInstallments})`
      : paymentMethod;

    const desc = paymentNotes.trim() 
      ? `Pagamento via ${finalMethod} (${paymentNotes.trim()})` 
      : `Pagamento via ${finalMethod}`;

    onAddTransaction(selectedAccountId, 'payment', amount, desc, finalMethod);

    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentMethod('Dinheiro');
    setPaymentInstallments('1x');
    setIsPaymentModalOpen(false);
  };

  return (
    <div className="section-card" style={{ animation: 'fadeIn 0.3s ease-out', padding: '24px' }}>
      {/* Topo do Módulo & Estatísticas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', fontSize: '20px', fontWeight: '800' }}>
            <Users size={24} style={{ color: 'var(--primary)' }} />
            Contas Fiado / Marcados
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Gerencie as compras a prazo, envie cobranças via WhatsApp e registre recebimentos.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="stat-card-compact" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 18px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', minWidth: '130px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Clientes Devedores</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{activeDebtors}</span>
          </div>

          <div className="stat-card-compact" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 18px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', minWidth: '130px' }}>
            <span style={{ fontSize: '10px', color: 'var(--danger)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={11} /> Em Atraso
            </span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: overdueAccounts > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{overdueAccounts}</span>
          </div>

          <div className="stat-card-compact" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '12px 20px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', border: '1px solid rgba(239, 68, 68, 0.25)', minWidth: '160px' }}>
            <span style={{ fontSize: '10px', color: 'var(--danger)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Pendente</span>
            <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--danger)' }}>R$ {totalCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Barra de Ações & Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ maxWidth: '340px', flex: 1 }}>
            <Search className="input-icon" size={18} style={{ left: '16px' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Buscar por cliente, função ou telefone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '44px' }}
            />
          </div>

          {/* Filtros Rápidos */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setFilterType('debtors')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterType === 'debtors' ? 'var(--primary)' : 'transparent',
                color: filterType === 'debtors' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Com Débito ({activeDebtors})
            </button>
            <button
              onClick={() => setFilterType('overdue')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterType === 'overdue' ? 'var(--danger)' : 'transparent',
                color: filterType === 'overdue' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Vencidos ({overdueAccounts})
            </button>
            <button
              onClick={() => setFilterType('paid')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterType === 'paid' ? 'var(--success)' : 'transparent',
                color: filterType === 'paid' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Quitados
            </button>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterType === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                color: filterType === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              Todos ({creditAccounts.length})
            </button>
          </div>
        </div>

        <button className="btn-primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13px' }} onClick={handleOpenCreateModal}>
          <Plus size={16} /> Novo Cadastro
        </button>
      </div>

      {/* Tabela de Contas */}
      <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ padding: '14px 16px' }}>Cliente</th>
              <th>Função / Tipo</th>
              <th>Telefone</th>
              <th>Endereço</th>
              <th>Próximo Vencimento</th>
              <th style={{ textAlign: 'right' }}>Saldo Acumulado</th>
              <th style={{ width: '220px', textAlign: 'center' }}>Ações Rápidas</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map(acc => {
              const summary = getAccountDebtSummary(acc);
              const isLate = isAccountOverdue(acc);
              const waLink = generateWhatsAppFiadoLink(acc, summary);

              return (
                <tr key={acc.id} className="hover-item" style={{ cursor: 'pointer' }} onClick={() => setSelectedAccountId(acc.id)}>
                  <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {acc.name}
                      {isLate && (
                        <span title="Conta vencida" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                          VENCIDO
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '3px 8px', 
                      backgroundColor: acc.role === 'Pedreiro' ? 'rgba(18, 121, 138, 0.12)' : 'var(--bg-secondary)', 
                      color: acc.role === 'Pedreiro' ? 'var(--primary)' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)', 
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {acc.role || 'Cliente'}
                    </span>
                  </td>
                  <td>
                    {acc.phone ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Phone size={12} style={{ color: 'var(--text-muted)' }} /> {acc.phone}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ fontSize: '13px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={acc.address}>
                    {acc.address || '-'}
                  </td>
                  <td>
                    {summary && summary.dueDate ? (
                      <span style={{ 
                        fontWeight: '700', 
                        fontSize: '12px',
                        color: isLate ? 'var(--danger)' : 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {isLate ? <AlertTriangle size={13} style={{ color: 'var(--danger)' }} /> : <Clock size={13} style={{ color: 'var(--text-muted)' }} />}
                        {new Date(summary.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                    )}
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    fontWeight: '800', 
                    fontSize: '15px', 
                    color: acc.balance > 0 ? 'var(--danger)' : 'var(--success)' 
                  }}>
                    R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {/* Cobrar no WhatsApp */}
                      {waLink && acc.balance > 0 && (
                        <a 
                          href={waLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn-secondary" 
                          title="Cobrar pelo WhatsApp"
                          style={{ padding: '6px 8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 'var(--radius-sm)' }}
                        >
                          <MessageCircle size={14} />
                        </a>
                      )}

                      {/* Imprimir Extrato */}
                      <button 
                        className="btn-secondary" 
                        title="Imprimir Extrato de Débito"
                        style={{ padding: '6px 8px' }}
                        onClick={() => setPrintStatementAccount(acc)}
                      >
                        <Printer size={14} />
                      </button>

                      {/* Ver Extrato Completo */}
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '700' }} 
                        onClick={() => setSelectedAccountId(acc.id)}
                      >
                        Extrato
                      </button>

                      {/* Editar */}
                      <button 
                        className="btn-secondary" 
                        title="Editar Cadastro"
                        style={{ padding: '6px 8px' }}
                        onClick={(e) => handleOpenEditModal(acc, e)}
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Excluir */}
                      {onDeleteAccount && (
                        <button 
                          className="btn-secondary" 
                          title="Excluir Conta"
                          style={{ padding: '6px 8px', color: 'var(--danger)' }}
                          onClick={(e) => handleDeleteAccount(acc, e)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredAccounts.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
                  <div>Nenhuma conta a receber localizada com este filtro.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes da Conta (Extrato Completo & Baixa) */}
      {selectedAccount && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '780px', width: '95%', maxHeight: '90vh' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{selectedAccount.name}</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={12} /> {selectedAccount.role || 'Cliente'}</span>
                  {selectedAccount.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {selectedAccount.phone}</span>}
                  {selectedAccount.address && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {selectedAccount.address}</span>}
                </div>
              </div>
              <button onClick={() => { setSelectedAccountId(null); setIsPaymentModalOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={24} /></button>
            </div>

            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              {/* Cards de Saldo & Ações no Topo do Extrato */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Dívida Total Acumulada</div>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: selectedAccount.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    R$ {selectedAccount.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {generateWhatsAppFiadoLink(selectedAccount, getAccountDebtSummary(selectedAccount)) && selectedAccount.balance > 0 && (
                    <a
                      href={generateWhatsAppFiadoLink(selectedAccount, getAccountDebtSummary(selectedAccount))}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)', fontWeight: '700', fontSize: '13px' }}
                    >
                      <MessageCircle size={18} /> Cobrar no WhatsApp
                    </a>
                  )}

                  <button
                    className="btn-secondary"
                    style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px' }}
                    onClick={() => setPrintStatementAccount(selectedAccount)}
                  >
                    <Printer size={18} /> Imprimir Extrato
                  </button>

                  <button 
                    className="btn-primary" 
                    style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '800' }} 
                    onClick={() => {
                      setPaymentAmount(selectedAccount.balance > 0 ? selectedAccount.balance.toFixed(2) : '');
                      setIsPaymentModalOpen(true);
                    }}
                  >
                    <DollarSign size={18} /> Dar Baixa / Receber
                  </button>
                </div>
              </div>

              {/* Caixa de Registro de Pagamento */}
              {isPaymentModalOpen && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', backgroundColor: 'rgba(34, 197, 94, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                      <DollarSign size={18} style={{ color: 'var(--success)' }} /> Registrar Recebimento / Dar Baixa
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setIsPaymentModalOpen(false)}><X size={16} /></button>
                  </div>

                  {/* Atalho de Quitação Total */}
                  {selectedAccount.balance > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saldo devedor total: <strong>R$ {selectedAccount.balance.toFixed(2)}</strong></span>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}
                        onClick={() => setPaymentAmount(selectedAccount.balance.toFixed(2))}
                      >
                        Quitar Valor Total (R$ {selectedAccount.balance.toFixed(2)})
                      </button>
                    </div>
                  )}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: paymentMethod === 'Cartão Crédito' ? '1.2fr 1.2fr 1fr 1.8fr' : '1.2fr 1.2fr 2fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12px' }}>Valor Pago (R$)</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>R$</span>
                        <input 
                          type="text" 
                          placeholder="0,00"
                          value={paymentAmount} 
                          onChange={e => setPaymentAmount(e.target.value)} 
                          style={{ paddingLeft: '34px', width: '100%', fontWeight: '700', fontSize: '14px' }}
                          autoFocus 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12px' }}>Forma de Pagamento</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Pix">Pix</option>
                        <option value="Cartão Crédito">Cartão Crédito</option>
                        <option value="Cartão Débito">Cartão Débito</option>
                      </select>
                    </div>
                    {paymentMethod === 'Cartão Crédito' && (
                      <div className="form-group">
                        <label style={{ fontWeight: '700', fontSize: '12px' }}>Parcelas</label>
                        <select value={paymentInstallments} onChange={e => setPaymentInstallments(e.target.value)}>
                          <option value="1x">1x (À vista)</option>
                          <option value="2x">2x</option>
                          <option value="3x">3x</option>
                          <option value="4x">4x</option>
                          <option value="5x">5x</option>
                          <option value="6x">6x</option>
                          <option value="7x">7x</option>
                          <option value="8x">8x</option>
                          <option value="9x">9x</option>
                          <option value="10x">10x</option>
                          <option value="11x">11x</option>
                          <option value="12x">12x</option>
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label style={{ fontWeight: '700', fontSize: '12px' }}>Observações (Opcional)</label>
                      <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Ex: Parcial, Quitação da obra..." />
                    </div>
                  </div>

                  {/* Saldo Restante Calculado */}
                  {(() => {
                    const paidVal = parseFloat(paymentAmount.replace(',', '.')) || 0;
                    if (paidVal > 0) {
                      const remaining = Math.max(0, (selectedAccount.balance || 0) - paidVal);
                      return (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                          <span>Saldo restante após esta baixa:</span>
                          <strong style={{ color: remaining === 0 ? 'var(--success)' : 'var(--danger)' }}>
                            R$ {remaining.toFixed(2)} {remaining === 0 ? '(CONTA 100% QUITADA 🎉)' : ''}
                          </strong>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn-secondary" style={{ padding: '8px 16px', width: 'auto' }} onClick={() => setIsPaymentModalOpen(false)}>Cancelar</button>
                    <button className="btn-primary" style={{ padding: '8px 24px', width: 'auto', fontWeight: '800' }} onClick={handlePayment} disabled={!paymentAmount}>
                      Confirmar e Imprimir Recibo
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de Histórico da Conta */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--text-primary)' }}>
                  Histórico de Compras e Pagamentos
                </h3>
                
                <div className="table-container" style={{ margin: 0, maxHeight: '360px', overflowY: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ padding: '12px 10px' }}>Data</th>
                        <th>Operação</th>
                        <th>Descrição / Itens</th>
                        <th style={{ textAlign: 'right', paddingRight: '16px' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedAccount.history || []).slice().reverse().map(trans => {
                        const isLate = trans.type === 'charge' && trans.dueDate && new Date(trans.dueDate) < new Date(new Date().toISOString().split('T')[0]);
                        return (
                          <tr key={trans.id} className="hover-item">
                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top', padding: '12px 10px', fontSize: '12px' }}>
                              {new Date(trans.timestamp).toLocaleString('pt-BR')}
                            </td>
                            <td style={{ verticalAlign: 'top', padding: '12px 10px' }}>
                              <div>
                                {trans.type === 'charge' ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                    <ArrowUpRight size={14} /> Venda Fiado
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--success)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                    <ArrowDownLeft size={14} /> Pagamento
                                  </span>
                                )}
                              </div>
                              
                              {trans.type === 'charge' && trans.dueDate && (
                                <div style={{ 
                                  fontSize: '11px', 
                                  marginTop: '4px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  fontWeight: '700', 
                                  color: isLate ? 'var(--danger)' : 'var(--text-muted)' 
                                }}>
                                  {isLate ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                                  Vencimento: {new Date(trans.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </div>
                              )}
                              
                              {trans.items && (
                                <button 
                                  className="btn-secondary" 
                                  style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '10px', 
                                    width: 'auto', 
                                    height: 'auto', 
                                    marginTop: '6px', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px' 
                                  }}
                                  onClick={() => onViewReceipt({
                                    id: trans.saleId || `F-${trans.id.slice(-4)}`,
                                    items: trans.items,
                                    paymentMethod: trans.type === 'payment' ? (trans.paymentMethod || 'Dinheiro') : 'Fiado',
                                    amountPaid: trans.type === 'payment' && (trans.paymentMethod || 'Dinheiro') === 'Dinheiro' ? trans.amount : 0,
                                    timestamp: trans.timestamp,
                                    deliveryDetails: trans.deliveryDetails
                                  })}
                                >
                                  <Receipt size={12} /> Ver Cupom
                                </button>
                              )}
                            </td>
                            <td style={{ verticalAlign: 'top', padding: '12px 10px' }}>
                              <div style={{ fontWeight: '600', fontSize: '13px' }}>
                                {trans.description}
                                {trans.saleId && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Venda #{trans.saleId.substring(trans.saleId.length - 4)})</span>}
                              </div>
                              
                              {trans.items && trans.items.length > 0 && (
                                <div style={{ 
                                  marginTop: '6px', 
                                  padding: '8px 10px', 
                                  backgroundColor: 'var(--bg-secondary)', 
                                  borderRadius: 'var(--radius-sm)', 
                                  border: '1px dashed var(--border-color)', 
                                  fontSize: '12px' 
                                }}>
                                  <div style={{ fontWeight: '700', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '10px', textTransform: 'uppercase' }}>Produtos:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {trans.items.map((item, idx) => (
                                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                        <span>• {item.quantity}x {item.name}</span>
                                        <span style={{ fontWeight: '600' }}>R$ {(item.salePrice * item.quantity).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td style={{ 
                              textAlign: 'right', 
                              fontWeight: '800', 
                              verticalAlign: 'top',
                              padding: '12px 16px 12px 10px', 
                              fontSize: '14px',
                              color: trans.type === 'charge' ? 'var(--danger)' : 'var(--success)' 
                            }}>
                              {trans.type === 'charge' ? '+' : '-'} R$ {trans.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedAccount.history || selectedAccount.history.length === 0) && (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Sem transações registradas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Cadastro */}
      {isFormModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                {editingAccountId ? <Edit2 size={20} style={{ color: 'var(--primary)' }} /> : <PlusCircle size={20} style={{ color: 'var(--primary)' }} />}
                {editingAccountId ? 'Editar Conta de Fiado' : 'Novo Cadastro de Fiado'}
              </h2>
              <button onClick={() => setIsFormModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Nome Completo do Cliente *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Manoel Ferreira Souza" required autoFocus />
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Tipo / Cargo / Função</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)}>
                  <option value="Pedreiro">Pedreiro</option>
                  <option value="Empreiteiro">Empreiteiro</option>
                  <option value="Mestre de Obras">Mestre de Obras</option>
                  <option value="Cliente Físico">Cliente Físico</option>
                  <option value="Empresa">Empresa / Empreendimento</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Telefone / WhatsApp</label>
                <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Ex: (11) 97777-6666" />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Endereço Residencial / Comercial</label>
                <input type="text" value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Ex: Av. Principal, 500 - Bloco B" />
              </div>

              {!editingAccountId && (
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '13px' }}>Saldo Anterior Pendente (R$ - se houver)</label>
                  <input type="text" value={formBalance} onChange={e => setFormBalance(e.target.value)} placeholder="0,00" />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-secondary" style={{ padding: '12px', flex: 1 }} onClick={() => setIsFormModalOpen(false)}>Cancelar</button>
                <button className="btn-primary" style={{ padding: '12px', flex: 1, fontWeight: '800' }} onClick={handleSaveForm} disabled={!formName.trim()}>
                  {editingAccountId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão de Extrato */}
      {printStatementAccount && (
        <FiadoStatementPrintModal
          account={printStatementAccount}
          onClose={() => setPrintStatementAccount(null)}
        />
      )}
    </div>
  );
}
