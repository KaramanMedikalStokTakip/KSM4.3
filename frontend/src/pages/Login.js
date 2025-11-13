import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Eye, EyeOff, UserCircle2, Moon, Sun } from 'lucide-react';
import ParticleNetworkAnimation from '../components/ParticleNetworkAnimation';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Check for dark mode on load
  useEffect(() => {
    const darkMode = document.body.classList.contains('dark-mode');
    setIsDarkMode(darkMode);
  }, []);

  // Load saved credentials if "remember me" was checked
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedUsername && savedPassword) {
      setLoginForm({ username: savedUsername, password: savedPassword });
      setRememberMe(true);
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginForm);
      
      // Save credentials if "remember me" is checked
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', loginForm.username);
        localStorage.setItem('rememberedPassword', loginForm.password);
      } else {
        localStorage.removeItem('rememberedUsername');
        localStorage.removeItem('rememberedPassword');
      }
      
      login(response.data.access_token, response.data.user);
      toast.success('Giriş başarılı!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-blue-50'
    }`}>
      {/* Particle Network Animation */}
      <ParticleNetworkAnimation isDark={isDarkMode} />

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className={`fixed top-6 right-6 z-50 p-3 rounded-full backdrop-blur-md transition-all duration-300 ${
          isDarkMode
            ? 'bg-gray-800/50 text-yellow-400 hover:bg-gray-700/60'
            : 'bg-white/50 text-blue-600 hover:bg-white/70'
        } shadow-lg`}
        aria-label="Toggle theme"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Logo Watermark - Colorful */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          backgroundImage: 'url(/logo.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: isDarkMode ? 0.08 : 0.1
        }}
      />

      {/* Login Card with Glassmorphism */}
      <div 
        className={`w-full max-w-md relative z-10 p-10 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          isDarkMode
            ? 'bg-gray-800/40 border border-gray-700/50'
            : 'bg-white/65 border border-white/80'
        }`}
        data-testid="login-card"
      >
        {/* Header with Icon */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
            isDarkMode
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-blue-500/10 text-blue-600'
          } animate-bounce`}>
            <UserCircle2 className="w-10 h-10" />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Karaman Sağlık Medikal Yönetim Paneli
          </h2>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Username Input */}
          <div className="relative">
            <Label 
              htmlFor="username" 
              className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Kullanıcı Adı veya E-posta
            </Label>
            <Input
              id="username"
              data-testid="login-username-input"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              required
              className={`mt-1 transition-all ${
                isDarkMode
                  ? 'bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20'
                  : 'bg-white/50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
              placeholder="Kullanıcı adınızı girin"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <Label 
              htmlFor="password" 
              className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Şifre
            </Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                data-testid="login-password-input"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
                className={`pr-10 transition-all ${
                  isDarkMode
                    ? 'bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20'
                    : 'bg-white/50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                }`}
                placeholder="Şifrenizi girin"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid="toggle-password-btn"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex justify-start items-center text-sm">
            <label className={`flex items-center cursor-pointer transition-colors ${
              isDarkMode
                ? 'text-gray-300 hover:text-blue-400'
                : 'text-gray-600 hover:text-blue-600'
            }`}>
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mr-2 accent-blue-600"
                data-testid="remember-me-checkbox"
              />
              Beni Hatırla
            </label>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className={`w-full font-bold py-3 rounded-lg shadow-lg transition-all duration-200 ${
              isDarkMode
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
            } hover:shadow-xl hover:scale-[1.02]`}
            disabled={loading} 
            data-testid="login-submit-btn"
          >
            {loading ? 'Giriş yapılıyor...' : 'GİRİŞ YAP'}
          </Button>
        </form>

        {/* Footer */}
        <div className={`mt-6 text-center text-xs ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          © 2026 Karaman Sağlık Medikal <br />
          Güvenli Giriş Sistemi
        </div>
      </div>
    </div>
  );
}

export default Login;
