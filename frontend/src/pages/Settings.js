import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Moon, Sun, Plus, Edit2, Trash2 } from 'lucide-react';

const ROLE_PERMISSIONS = {
  'yönetici': {
    dashboard: true,
    stock_view: true,
    stock_add: true,
    stock_edit: true,
    stock_delete: true,
    view_purchase_price: true,
    pos: true,
    customers_view: true,
    customers_add: true,
    customers_edit: true,
    reports: true,
    calendar: true,
    settings: true,
    user_management: true
  },
  'depo': {
    dashboard: true,
    stock_view: true,
    stock_add: true,
    stock_edit: true,
    stock_delete: false,
    view_purchase_price: false,
    pos: false,
    customers_view: false,
    customers_add: false,
    customers_edit: false,
    reports: false,
    calendar: true,
    settings: false,
    user_management: false
  },
  'satış': {
    dashboard: true,
    stock_view: true,
    stock_add: false,
    stock_edit: false,
    stock_delete: false,
    view_purchase_price: false,
    pos: true,
    customers_view: true,
    customers_add: true,
    customers_edit: true,
    reports: true,
    calendar: true,
    settings: false,
    user_management: false
  }
};

function Settings() {
  const { user } = useAuth();
  const [theme, setTheme] = useState('light');
  const [showDashboardStats, setShowDashboardStats] = useState(true);
  const [showLowStockAlerts, setShowLowStockAlerts] = useState(true);
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState(ROLE_PERMISSIONS);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'depo'
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedStats = localStorage.getItem('showDashboardStats') !== 'false';
    const savedAlerts = localStorage.getItem('showLowStockAlerts') !== 'false';
    const savedPermissions = localStorage.getItem('rolePermissions');
    
    setTheme(savedTheme);
    setShowDashboardStats(savedStats);
    setShowLowStockAlerts(savedAlerts);
    if (savedPermissions) {
      setRolePermissions(JSON.parse(savedPermissions));
    }
    
    applyTheme(savedTheme);
    
    if (user?.role === 'yönetici') {
      fetchUsers();
    }
  }, [user]);

  const applyTheme = (newTheme) => {
    if (newTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Users fetch error:', error);
      // Fallback to current user if API fails
      setUsers([
        { id: user.id, username: user.username, email: user.email, role: user.role }
      ]);
    }
  };

  const handleThemeChange = (checked) => {
    const newTheme = checked ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    toast.success(`Tema ${newTheme === 'dark' ? 'karanlık' : 'açık'} moda geçildi`);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('showDashboardStats', showDashboardStats.toString());
    localStorage.setItem('showLowStockAlerts', showLowStockAlerts.toString());
    toast.success('Ayarlar kaydedildi');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, newUser);
      toast.success('Kullanıcı başarıyla eklendi');
      fetchUsers();
      setDialogOpen(false);
      setNewUser({ username: '', password: '', role: 'depo' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kullanıcı eklenemedi');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user.id) {
      toast.error('Kendi hesabınızı silemezsiniz');
      return;
    }
    
    if (window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      try {
        await axios.delete(`${API}/users/${userId}`);
        toast.success('Kullanıcı başarıyla silindi');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Kullanıcı silinemedi');
      }
    }
  };

  const handlePermissionChange = (role, permission) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role][permission]
      }
    }));
  };

  const saveRolePermissions = () => {
    localStorage.setItem('rolePermissions', JSON.stringify(rolePermissions));
    toast.success('Rol yetkileri kaydedildi');
    setPermissionDialogOpen(false);
  };

  const permissionLabels = {
    dashboard: 'Dashboard Görüntüleme',
    stock_view: 'Stok Görüntüleme',
    stock_add: 'Stok Ekleme',
    stock_edit: 'Stok Düzenleme',
    stock_delete: 'Stok Silme',
    view_purchase_price: 'Alış Fiyatını Görüntüleme',
    pos: 'Kasiyer/POS Erişimi',
    customers_view: 'Müşteri Görüntüleme',
    customers_add: 'Müşteri Ekleme',
    customers_edit: 'Müşteri Düzenleme',
    reports: 'Rapor Erişimi',
    calendar: 'Takvim Erişimi',
    settings: 'Ayarlar Erişimi',
    user_management: 'Kullanıcı Yönetimi'
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <h1 className="text-4xl font-bold">Ayarlar</h1>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Görünüm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <div>
                <Label>Karanlık Mod</Label>
                <p className="text-sm text-gray-500">Arayüzü koyu renge çevir</p>
              </div>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={handleThemeChange}
              data-testid="theme-toggle"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Dashboard Özelleştirme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>İstatistikleri Göster</Label>
              <p className="text-sm text-gray-500">Ana sayfada satış ve stok istatistiklerini göster</p>
            </div>
            <Switch
              checked={showDashboardStats}
              onCheckedChange={setShowDashboardStats}
              data-testid="stats-toggle"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Düşük Stok Uyarıları</Label>
              <p className="text-sm text-gray-500">Dashboard'da düşük stok uyarılarını göster</p>
            </div>
            <Switch
              checked={showLowStockAlerts}
              onCheckedChange={setShowLowStockAlerts}
              data-testid="alerts-toggle"
            />
          </div>

          <Button onClick={handleSaveSettings} className="w-full" data-testid="save-settings-btn">
            Ayarları Kaydet
          </Button>
        </CardContent>
      </Card>

      {user?.role === 'yönetici' && (
        <>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Kullanıcı Yönetimi</CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => setPermissionDialogOpen(true)} variant="outline" data-testid="manage-permissions-btn">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Rol Yetkileri
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-user-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Kullanıcı Ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div>
                        <Label>Kullanıcı Adı *</Label>
                        <Input
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          required
                          data-testid="new-username-input"
                        />
                      </div>
                      <div>
                        <Label>Şifre *</Label>
                        <Input
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          required
                          data-testid="new-password-input"
                        />
                      </div>
                      <div>
                        <Label>Rol *</Label>
                        <Select 
                          value={newUser.role} 
                          onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                        >
                          <SelectTrigger data-testid="new-role-select">
                            <SelectValue placeholder="Rol seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yönetici">Yönetici</SelectItem>
                            <SelectItem value="depo">Depo</SelectItem>
                            <SelectItem value="satış">Satış</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" data-testid="submit-user-btn">
                        Kullanıcı Ekle
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium">{u.username}</p>
                      <p className="text-sm text-gray-500">{u.email || 'E-posta yok'} - {u.role}</p>
                    </div>
                    {u.id !== user.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-user-${u.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Rol Bazlı Yetkilendirme</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {Object.keys(rolePermissions).map(role => (
                  <Card key={role}>
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{role}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.keys(permissionLabels).map(permission => (
                          <div key={permission} className="flex items-center justify-between">
                            <Label className="text-sm">{permissionLabels[permission]}</Label>
                            <Switch
                              checked={rolePermissions[role][permission]}
                              onCheckedChange={() => handlePermissionChange(role, permission)}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={saveRolePermissions} className="w-full" data-testid="save-permissions-btn">
                  Yetkileri Kaydet
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Uygulama Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Sürüm:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Firma:</span>
              <span className="font-medium">Karaman Sağlık Medikal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Platform:</span>
              <span className="font-medium">Emergent.sh</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;