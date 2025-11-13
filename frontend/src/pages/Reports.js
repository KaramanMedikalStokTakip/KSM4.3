import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import { Label } from '../components/ui/label';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from 'docx';
import { saveAs } from 'file-saver';

function Reports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [topSelling, setTopSelling] = useState([]);
  const [topProfit, setTopProfit] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Stok raporu için state'ler
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockReport, setStockReport] = useState(null);

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const response = await axios.get(`${API}/products/filters`);
      setBrands(response.data.brands);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Filtreler yüklenemedi', error);
    }
  };

  const fetchTopSelling = async () => {
    if (!startDate || !endDate) {
      toast.error('Lütfen tarih aralığı seçin');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/reports/top-selling`, {
        params: { start_date: startDate, end_date: endDate, limit: 10 }
      });
      setTopSelling(response.data);
    } catch (error) {
      toast.error('Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopProfit = async () => {
    if (!startDate || !endDate) {
      toast.error('Lütfen tarih aralığı seçin');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/reports/top-profit`, {
        params: { start_date: startDate, end_date: endDate, limit: 10 }
      });
      setTopProfit(response.data);
    } catch (error) {
      toast.error('Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data, filename) => {
    const csvContent = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    toast.success('Rapor indirildi');
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <h1 className="text-4xl font-bold text-gray-800">Raporlar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Tarih Aralığı Seçin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-600">Başlangıç Tarihi</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="start-date-input"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-600">Bitiş Tarihi</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="end-date-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="selling" className="w-full">
        <TabsList className="grid w-full grid-cols-2 reports-tabs-list">
          <TabsTrigger value="selling" className="reports-tab-trigger">En Çok Satanlar</TabsTrigger>
          <TabsTrigger value="profit" className="reports-tab-trigger">En Kârlılar</TabsTrigger>
        </TabsList>

        <TabsContent value="selling" className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchTopSelling} disabled={loading} data-testid="fetch-top-selling-btn">
              {loading ? 'Yükleniyor...' : 'Raporu Oluştur'}
            </Button>
            {topSelling.length > 0 && (
              <Button variant="outline" onClick={() => exportToExcel(topSelling, 'en-cok-satanlar')} data-testid="export-selling-btn">
                <Download className="w-4 h-4 mr-2" />
                Excel İndir
              </Button>
            )}
          </div>

          {topSelling.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topSelling}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="product_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_quantity" fill="#3b82f6" name="Satılan Adet" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 space-y-2">
                  {topSelling.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{idx + 1}. {item.product_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">{item.total_quantity} adet</p>
                        <p className="text-sm text-gray-500">₺{item.total_revenue?.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profit" className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchTopProfit} disabled={loading} data-testid="fetch-top-profit-btn">
              {loading ? 'Yükleniyor...' : 'Raporu Oluştur'}
            </Button>
            {topProfit.length > 0 && (
              <Button variant="outline" onClick={() => exportToExcel(topProfit, 'en-karlilar')} data-testid="export-profit-btn">
                <Download className="w-4 h-4 mr-2" />
                Excel İndir
              </Button>
            )}
          </div>

          {topProfit.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topProfit}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="product_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_profit" fill="#10b981" name="Toplam Kâr (₺)" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 space-y-2">
                  {topProfit.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{idx + 1}. {item.product_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">₺{item.total_profit?.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{item.total_quantity} adet satıldı</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Reports;