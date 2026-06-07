import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';

export default function Acesso() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!usuario || !senha) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    setCarregando(true);

    try {
      // Faz o login por texto puro chamando o nosso adaptador do Firebase
      await base44.auth.login({ 
        username: usuario, 
        password: senha 
      });
      
      // Se as credenciais estiverem certas no banco, avança para a Home
      navigate('/home');
    } catch (error) {
      console.error("Erro no login:", error);
      alert(error.message || 'Usuário ou senha incorretos.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-800">SISPROD BM</h2>
          <p className="text-sm text-slate-500">Controle de Produção</p>
        </div>
        
        <div className="space-y-1">
          <Label htmlFor="usuario">Usuário / ID</Label>
          <Input 
            id="usuario"
            type="text" 
            value={usuario} 
            onChange={(e) => setUsuario(e.target.value)} 
            placeholder="Digite seu usuário"
            disabled={carregando}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="senha">Senha</Label>
          <Input 
            id="senha"
            type="password" 
            value={senha} 
            onChange={(e) => setSenha(e.target.value)} 
            placeholder="Digite sua senha"
            disabled={carregando}
          />
        </div>

        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={carregando}>
          {carregando ? 'Verificando...' : 'Acessar'}
        </Button>
        
        <div className="text-center pt-2">
          <button 
            type="button" 
            onClick={() => navigate('/solicitar-acesso')} 
            className="text-xs text-emerald-600 hover:underline"
          >
            Solicitar Acesso ao Sistema
          </button>
        </div>
      </form>
    </div>
  );
}
