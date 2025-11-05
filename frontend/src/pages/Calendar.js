import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Calendar as CalendarIcon, Plus, Bell, Trash2 } from 'lucide-react';
import { Calendar as CalendarComponent } from '../components/ui/calendar';

function Calendar() {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    alarm: false
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/calendar`);
      setEvents(response.data);
    } catch (error) {
      toast.error('Etkinlikler yüklenemedi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/calendar`, {
        ...formData,
        date: new Date(formData.date).toISOString()
      });
      toast.success('Etkinlik eklendi');
      fetchEvents();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await axios.delete(`${API}/calendar/${eventId}`);
      toast.success('Etkinlik silindi');
      fetchEvents();
      setDetailDialogOpen(false);
    } catch (error) {
      toast.error('Silme işlemi başarısız');
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', date: '', alarm: false });
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">Takvim ve Notlar</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-event-btn">
              <Plus className="w-4 h-4 mr-2" />
              Yeni Etkinlik
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Etkinlik Ekle</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Başlık *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="event-title-input"
                />
              </div>
              <div>
                <Label>Açıklama</Label>
                <textarea
                  className="w-full border rounded-md px-3 py-2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="event-description-input"
                />
              </div>
              <div>
                <Label>Tarih ve Saat *</Label>
                <Input
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  data-testid="event-date-input"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alarm"
                  checked={formData.alarm}
                  onChange={(e) => setFormData({ ...formData, alarm: e.target.checked })}
                  data-testid="event-alarm-checkbox"
                />
                <Label htmlFor="alarm" className="cursor-pointer">Hatırlatıcı Ekle</Label>
              </div>
              <Button type="submit" className="w-full" data-testid="submit-event-btn">Ekle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 flex justify-center">
            <div onDoubleClick={(e) => {
              if (selectedDate) {
                const dateStr = selectedDate.toISOString().slice(0, 16);
                setFormData({ ...formData, date: dateStr });
                setDialogOpen(true);
              }
            }}>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Bu tarihte etkinlik yok</p>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors" 
                    data-testid={`event-${event.id}`}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800">{event.title}</h4>
                          {event.alarm && <Bell className="w-4 h-4 text-blue-600" />}
                        </div>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(event.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tüm Etkinlikler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events.map((event) => (
              <div 
                key={event.id} 
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleEventClick(event)}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(event.date).toLocaleDateString('tr-TR')} - {new Date(event.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {event.alarm && <Bell className="w-4 h-4 text-blue-600" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etkinlik Detayları</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600">Başlık</Label>
                <p className="text-lg font-semibold text-gray-800 mt-1">{selectedEvent.title}</p>
              </div>
              
              {selectedEvent.description && (
                <div>
                  <Label className="text-gray-600">Açıklama</Label>
                  <p className="text-gray-700 mt-1">{selectedEvent.description}</p>
                </div>
              )}
              
              <div>
                <Label className="text-gray-600">Tarih ve Saat</Label>
                <p className="text-gray-800 mt-1">
                  {new Date(selectedEvent.date).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} - {new Date(selectedEvent.date).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              
              <div>
                <Label className="text-gray-600">Hatırlatıcı</Label>
                <div className="flex items-center gap-2 mt-1">
                  {selectedEvent.alarm ? (
                    <>
                      <Bell className="w-4 h-4 text-blue-600" />
                      <p className="text-gray-800">Hatırlatıcı aktif</p>
                    </>
                  ) : (
                    <p className="text-gray-500">Hatırlatıcı yok</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDetailDialogOpen(false)}
                >
                  Kapat
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedEvent.id)}
                  data-testid={`delete-event-detail-${selectedEvent.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Calendar;