"""
Test verilerini MongoDB'ye ekleyen script
Bu script 5 medikal ürün, 5 müşteri ve 5 etkinlik ekler
"""
import os
import asyncio
import uuid
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def add_medical_products():
    """5 adet medikal ürün ekle"""
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Dijital Tansiyon Aleti",
            "barcode": f"MED{str(uuid.uuid4())[:8].upper()}",
            "brand": "Omron",
            "category": "Tıbbi Cihaz",
            "quantity": 3,  # Düşük stok
            "min_quantity": 5,
            "unit_type": "adet",
            "package_quantity": 1,
            "purchase_price": 350.00,
            "sale_price": 499.90,
            "description": "Dijital koldan tansiyon ölçüm cihazı, hafıza özellikli",
            "image_url": "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "İnfrared Ateş Ölçer",
            "barcode": f"MED{str(uuid.uuid4())[:8].upper()}",
            "brand": "Beurer",
            "category": "Tıbbi Cihaz",
            "quantity": 12,
            "min_quantity": 10,
            "unit_type": "adet",
            "package_quantity": 1,
            "purchase_price": 180.00,
            "sale_price": 299.00,
            "description": "Temassız infrared ateş ölçer, hızlı ve hassas",
            "image_url": "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Steril Eldiven Lateks",
            "barcode": f"MED{str(uuid.uuid4())[:8].upper()}",
            "brand": "Medline",
            "category": "Medikal Malzeme",
            "quantity": 45,
            "min_quantity": 50,
            "unit_type": "kutu",
            "package_quantity": 100,
            "purchase_price": 85.00,
            "sale_price": 129.90,
            "description": "Pudrasız steril lateks eldiven, 100'lü kutu",
            "image_url": "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Nebulizatör Cihazı",
            "barcode": f"MED{str(uuid.uuid4())[:8].upper()}",
            "brand": "Braun",
            "category": "Tıbbi Cihaz",
            "quantity": 8,
            "min_quantity": 5,
            "unit_type": "adet",
            "package_quantity": 1,
            "purchase_price": 420.00,
            "sale_price": 649.00,
            "description": "Kompresörlü nebulizatör, yetişkin ve çocuk için",
            "image_url": "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Kan Şekeri Test Çubuğu",
            "barcode": f"MED{str(uuid.uuid4())[:8].upper()}",
            "brand": "Accu-Chek",
            "category": "Medikal Malzeme",
            "quantity": 20,
            "min_quantity": 25,
            "unit_type": "kutu",
            "package_quantity": 50,
            "purchase_price": 95.00,
            "sale_price": 149.00,
            "description": "Kan şekeri test strip'leri, 50'li kutu",
            "image_url": "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        }
    ]
    
    result = await db.products.insert_many(products)
    print(f"✅ {len(result.inserted_ids)} adet medikal ürün eklendi")
    return products

async def add_customers():
    """5 adet müşteri ekle"""
    customers = [
        {
            "id": str(uuid.uuid4()),
            "name": "Ayşe Yılmaz",
            "phone": "0532 123 4567",
            "email": "ayse.yilmaz@email.com",
            "address": "Merkez Mah. Cumhuriyet Cad. No:12 Karaman",
            "notes": "Düzenli müşteri, ödemeler nakit",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mehmet Demir",
            "phone": "0542 234 5678",
            "email": "mehmet.demir@email.com",
            "address": "Yenişehir Mah. Atatürk Bulvarı No:45 Karaman",
            "notes": "Toptan alım yapıyor",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Fatma Şahin",
            "phone": "0552 345 6789",
            "email": "fatma.sahin@email.com",
            "address": "Çamlık Mah. İnönü Sok. No:8 Karaman",
            "notes": "Kartlı ödeme tercih ediyor",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ali Kara",
            "phone": "0562 456 7890",
            "email": "ali.kara@email.com",
            "address": "Güneş Mah. Barış Cad. No:23 Karaman",
            "notes": "Eczane sahibi, toptan müşteri",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Zeynep Arslan",
            "phone": "0572 567 8901",
            "email": "zeynep.arslan@email.com",
            "address": "Bahçe Mah. Değirmen Sok. No:17 Karaman",
            "notes": "Sağlık merkezi müşterisi",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "deleted": False
        }
    ]
    
    result = await db.customers.insert_many(customers)
    print(f"✅ {len(result.inserted_ids)} adet müşteri eklendi")
    return customers

async def add_calendar_events():
    """5 adet etkinlik ekle"""
    now = datetime.utcnow()
    events = [
        {
            "id": str(uuid.uuid4()),
            "title": "Stok Sayımı",
            "description": "Aylık stok kontrolü ve envanter sayımı yapılacak",
            "date": (now + timedelta(days=5)).replace(hour=9, minute=0, second=0, microsecond=0),
            "category": "Stok",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Tedarikçi Toplantısı",
            "description": "Yeni ürünler ve fiyat güncellemeleri görüşülecek",
            "date": (now + timedelta(days=7)).replace(hour=14, minute=0, second=0, microsecond=0),
            "category": "Toplantı",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Fiyat Güncellemesi",
            "description": "Sezon sonu fiyat güncellemeleri yapılacak",
            "date": (now + timedelta(days=10)).replace(hour=10, minute=0, second=0, microsecond=0),
            "category": "Stok",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Müşteri Ziyareti",
            "description": "Toptan müşteri ziyareti ve sipariş alımı",
            "date": (now + timedelta(days=12)).replace(hour=11, minute=0, second=0, microsecond=0),
            "category": "Müşteri",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Ürün Eğitimi",
            "description": "Yeni medikal cihazlar için personel eğitimi",
            "date": (now + timedelta(days=15)).replace(hour=15, minute=0, second=0, microsecond=0),
            "category": "Eğitim",
            "created_at": now,
            "updated_at": now
        }
    ]
    
    result = await db.calendar_events.insert_many(events)
    print(f"✅ {len(result.inserted_ids)} adet etkinlik eklendi")
    return events

async def main():
    try:
        print("🚀 Test verileri ekleniyor...")
        print("-" * 50)
        
        # Ürünleri ekle
        products = await add_medical_products()
        
        # Müşterileri ekle
        customers = await add_customers()
        
        # Etkinlikleri ekle
        events = await add_calendar_events()
        
        print("-" * 50)
        print("✅ Tüm test verileri başarıyla eklendi!")
        print(f"   • {len(products)} medikal ürün")
        print(f"   • {len(customers)} müşteri")
        print(f"   • {len(events)} etkinlik")
        
    except Exception as e:
        print(f"❌ Hata: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
