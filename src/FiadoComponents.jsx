import React, { useState } from 'react';
import { Users, Plus, Check, X, Search, FileText, CreditCard, DollarSign, Calendar, AlertTriangle, Phone, Briefcase, PlusCircle, ArrowUpRight, ArrowDownLeft, MapPin } from 'lucide-react';

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
    // Default to 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const filteredAccounts = creditAccounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    const account = {
      name: newName,
      role: newRole,
      phone: newPhone,
      address: newAddress,
      balance: parseFloat(newBalance.replace(',', '.')) || 0
    };
    onCreateAccount(account);
    setIsCreating(false);
    setSearchTerm(newName);
    
    // Set this newly created account as selected for checkout
    // Since saveCreditAccount is async and triggers state update in parent, 
    // it's safer to let the user select it from list or automatically select by name.
    // To make it simple, we just clear and return to list.
    setNewName('');
    setNewPhone('');
    setNewAddress('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '480px', overflow: 'hidden' }}>
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
              </div>
              
              <div className="form-group">
                <label>Data Limite para Pagamento (Vencimento)</label>
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
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cadastre um novo cliente ou prestador de serviço para marcar a venda a prazo.</div>
              
              <div className="form-group">
                <label>Nome Completo *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João da Silva Santos" required />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Tipo / Função</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="Pedreiro">Pedreiro</option>
                    <option value="Empreiteiro">Empreiteiro</option>
                    <option value="Mestre de Obras">Mestre de Obras</option>
                    <option value="Cliente Físico">Cliente Físico</option>
                    <option value="Empresa">Empresa / Obra</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Telefone / WhatsApp</label>
                  <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ex: (11) 98888-7777" />
                </div>
              </div>

              <div className="form-group">
                <label>Endereço Residencial / Comercial</label>
                <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Ex: Rua das Flores, 123 - Centro" />
              </div>

              <div className="form-group">
                <label>Saldo Inicial Acumulado (R$ - Devedor anterior se houver)</label>
                <input type="text" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="0,00" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setIsCreating(false)}>Voltar à lista</button>
                <button className="btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleCreate} disabled={!newName.trim()}>Criar Conta</button>
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
                          R$ {acc.balance.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Saldo atual</div>
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

export function CreditAccountsView({ creditAccounts, onCreateAccount, onAddTransaction, onViewReceipt }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [paymentInstallments, setPaymentInstallments] = useState('1x');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  const [isDirectCreating, setIsDirectCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Pedreiro');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBalance, setNewBalance] = useState('');

  const selectedAccount = creditAccounts.find(acc => acc.id === selectedAccountId);

  const filteredAccounts = creditAccounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (acc.role && acc.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalCredit = creditAccounts.reduce((sum, acc) => sum + (acc.balance > 0 ? acc.balance : 0), 0);
  const activeDebtors = creditAccounts.filter(acc => acc.balance > 0).length;

  const getNextDueDate = (account) => {
    if (!account.history || account.balance <= 0) return null;
    const charges = account.history.filter(t => t.type === 'charge' && t.dueDate);
    if (charges.length === 0) return null;
    
    // Sort chronological ascending
    const sorted = charges.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return sorted[0].dueDate;
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

  const handleDirectCreate = () => {
    if (!newName.trim()) return;
    const account = {
      name: newName,
      role: newRole,
      phone: newPhone,
      address: newAddress,
      balance: parseFloat(newBalance.replace(',', '.')) || 0
    };
    onCreateAccount(account);
    setIsDirectCreating(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewBalance('');
  };

  return (
    <div className="section-card" style={{ animation: 'fadeIn 0.3s ease-out', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', fontSize: '20px', fontWeight: '800' }}>
            <Users size={24} style={{ color: 'var(--primary)' }} />
            Contas Fiado / Marcados
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Gerencie as compras a prazo autorizadas e registre recebimentos.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="stat-card-compact" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 20px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Clientes Devedores</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{activeDebtors}</span>
          </div>
          <div className="stat-card-compact" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 20px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Pendente</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)' }}>R$ {totalCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div className="input-group" style={{ maxWidth: '380px', flex: 1 }}>
          <Search className="input-icon" size={18} style={{ left: '16px' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Buscar por cliente, pedreiro ou contato..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </div>

        <button className="btn-primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }} onClick={() => setIsDirectCreating(true)}>
          <Plus size={18} /> Novo Cadastro
        </button>
      </div>

      <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ padding: '16px' }}>Cliente</th>
              <th>Função / Tipo</th>
              <th>Telefone</th>
              <th>Endereço</th>
              <th>Data de Pagamento</th>
              <th style={{ textAlign: 'right' }}>Saldo Acumulado</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map(acc => (
              <tr key={acc.id} className="hover-item">
                <td style={{ padding: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{acc.name}</td>
                <td>
                  <span style={{ 
                    padding: '4px 10px', 
                    backgroundColor: acc.role === 'Pedreiro' ? 'rgba(18, 121, 138, 0.1)' : 'var(--bg-secondary)', 
                    color: acc.role === 'Pedreiro' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)', 
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {acc.role}
                  </span>
                </td>
                <td>{acc.phone ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <Phone size={12} style={{ color: 'var(--text-muted)' }} /> {acc.phone}
                  </span>
                ) : '-'}</td>
                <td style={{ fontSize: '13px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={acc.address}>
                  {acc.address || '-'}
                </td>
                <td>
                  {(() => {
                    const dueDateStr = getNextDueDate(acc);
                    if (!dueDateStr) return '-';
                    const isLate = new Date(dueDateStr) < new Date(new Date().toISOString().split('T')[0]);
                    return (
                      <span style={{ 
                        fontWeight: '700', 
                        color: isLate ? 'var(--danger)' : 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {isLate && <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />}
                        {new Date(dueDateStr + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ 
                  textAlign: 'right', 
                  fontWeight: '800', 
                  fontSize: '15px', 
                  color: acc.balance > 0 ? 'var(--danger)' : 'var(--success)' 
                }}>
                  R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', width: 'auto' }} onClick={() => setSelectedAccountId(acc.id)}>
                    <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Extrato
                  </button>
                </td>
              </tr>
            ))}
            {filteredAccounts.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
                  <div>Nenhuma conta a receber localizada.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes da Conta (Extrato) */}
      {selectedAccount && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '720px', width: '95%', maxHeight: '90vh' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{selectedAccount.name}</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={12} /> {selectedAccount.role}</span>
                  {selectedAccount.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {selectedAccount.phone}</span>}
                  {selectedAccount.address && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {selectedAccount.address}</span>}
                </div>
              </div>
              <button onClick={() => { setSelectedAccountId(null); setIsPaymentModalOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={24} /></button>
            </div>

            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '6px' }}>Dívida Acumulada</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: selectedAccount.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    R$ {selectedAccount.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <button className="btn-primary" style={{ height: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '15px' }} onClick={() => setIsPaymentModalOpen(true)}>
                    <DollarSign size={20} /> Registrar Recebimento
                  </button>
                </div>
              </div>

              {isPaymentModalOpen && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', backgroundColor: 'rgba(74, 222, 128, 0.04)', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Dar Baixa (Receber Dinheiro)</h3>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setIsPaymentModalOpen(false)}><X size={16} /></button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: paymentMethod === 'Cartão Crédito' ? '1.2fr 1.2fr 1fr 1.8fr' : '1.2fr 1.2fr 2fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>Valor Pago</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>R$</span>
                        <input 
                          type="text" 
                          placeholder="0,00"
                          value={paymentAmount} 
                          onChange={e => setPaymentAmount(e.target.value)} 
                          style={{ paddingLeft: '34px', width: '100%' }}
                          autoFocus 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Forma de Pagamento</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Pix">Pix</option>
                        <option value="Cartão Crédito">Cartão Crédito</option>
                        <option value="Cartão Débito">Cartão Débito</option>
                      </select>
                    </div>
                    {paymentMethod === 'Cartão Crédito' && (
                      <div className="form-group">
                        <label>Parcelas</label>
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
                      <label>Observações / Notas (Opcional)</label>
                      <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Ex: Parcial, Quitação" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn-secondary" style={{ padding: '8px 16px', width: 'auto' }} onClick={() => setIsPaymentModalOpen(false)}>Cancelar</button>
                    <button className="btn-primary" style={{ padding: '8px 24px', width: 'auto' }} onClick={handlePayment} disabled={!paymentAmount}>Confirmar Pagamento</button>
                  </div>
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--text-primary)' }}>Histórico da Conta</h3>
                
                <div className="table-container" style={{ margin: 0 }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Data</th>
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
                            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top', padding: '12px 10px' }}>{new Date(trans.timestamp).toLocaleString('pt-BR')}</td>
                            <td style={{ verticalAlign: 'top', padding: '12px 10px' }}>
                              <div>
                                {trans.type === 'charge' ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ArrowUpRight size={14} /> Venda Fiado
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--success)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ArrowDownLeft size={14} /> Pagamento
                                  </span>
                                )}
                              </div>
                              
                              {trans.type === 'charge' && trans.dueDate && (
                                <div style={{ 
                                  fontSize: '11px', 
                                  marginTop: '6px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  fontWeight: '700', 
                                  color: isLate ? 'var(--danger)' : 'var(--text-muted)' 
                                }}>
                                  {isLate ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                                  Venceu em: {new Date(trans.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
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
                                    marginTop: '8px', 
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
                                  <FileText size={12} /> Ver Cupom
                                </button>
                              )}
                            </td>
                            <td style={{ verticalAlign: 'top', padding: '12px 10px' }}>
                              <div style={{ fontWeight: '600' }}>
                                {trans.description}
                                {trans.saleId && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Venda #{trans.saleId.substring(trans.saleId.length - 4)})</span>}
                              </div>
                              
                              {trans.items && trans.items.length > 0 && (
                                <div style={{ 
                                  marginTop: '8px', 
                                  padding: '10px 12px', 
                                  backgroundColor: 'var(--bg-secondary)', 
                                  borderRadius: 'var(--radius-sm)', 
                                  border: '1px dashed var(--border-color)', 
                                  fontSize: '12px' 
                                }}>
                                  <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produtos Comprados:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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

      {/* Modal de Criação Direta (Aba Lateral) */}
      {isDirectCreating && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '450px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <PlusCircle size={20} style={{ color: 'var(--primary)' }} /> Novo Cadastro de Fiado
              </h2>
              <button onClick={() => setIsDirectCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Nome Completo do Cliente *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Manoel Ferreira Souza" required />
              </div>
              
              <div className="form-group">
                <label>Tipo / Cargo</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="Pedreiro">Pedreiro</option>
                  <option value="Empreiteiro">Empreiteiro</option>
                  <option value="Mestre de Obras">Mestre de Obras</option>
                  <option value="Cliente Físico">Cliente Físico</option>
                  <option value="Empresa">Empresa / Empreendimento</option>
                </select>
              </div>

              <div className="form-group">
                <label>Telefone / WhatsApp</label>
                <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ex: (11) 97777-6666" />
              </div>

              <div className="form-group">
                <label>Endereço Residencial / Comercial</label>
                <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Ex: Av. Principal, 500 - Bloco B" />
              </div>

              <div className="form-group">
                <label>Saldo Inicial Acumulado (R$ - Devedor anterior se houver)</label>
                <input type="text" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="0,00" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn-secondary" style={{ padding: '12px', flex: 1 }} onClick={() => setIsDirectCreating(false)}>Cancelar</button>
                <button className="btn-primary" style={{ padding: '12px', flex: 1 }} onClick={handleDirectCreate} disabled={!newName.trim()}>Salvar Cliente</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
