import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { ProveedorEmpresa } from './context/EmpresaContext';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <ProveedorEmpresa>
      <App />
    </ProveedorEmpresa>
  </ThemeProvider>
);
