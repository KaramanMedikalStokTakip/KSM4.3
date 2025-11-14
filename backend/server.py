from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import aiohttp
import asyncio
import base64
from io import BytesIO
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION = int(os.environ.get('JWT_EXPIRATION_HOURS', 168))

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    role: str = "depo"  # yönetici, depo, satış
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    role: str = "depo"

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    barcode: str
    quantity: int
    min_quantity: int
    brand: str
    category: str
    purchase_price: float
    sale_price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    unit_type: str = "adet"  # adet veya kutu
    package_quantity: Optional[int] = None  # Kutu içeriği adedi (sadece kutu için)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    barcode: str
    quantity: int
    min_quantity: int
    brand: str
    category: str
    purchase_price: float
    sale_price: float
    description: Optional[str] = None
    image_base64: Optional[str] = None
    unit_type: str = "adet"
    package_quantity: Optional[int] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    barcode: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    description: Optional[str] = None
    image_base64: Optional[str] = None
    unit_type: Optional[str] = None
    package_quantity: Optional[int] = None

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[dict]  # [{product_id, name, quantity, price, total}]
    total_amount: float
    discount: float = 0
    final_amount: float
    payment_method: str  # nakit, kredi_karti
    customer_id: Optional[str] = None
    cashier_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaleCreate(BaseModel):
    items: List[dict]
    total_amount: float
    discount: float = 0
    payment_method: str
    customer_id: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    total_spent: float = 0
    deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CalendarEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    date: datetime
    alarm: bool = False
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: datetime
    alarm: bool = False

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_dict = user_data.model_dump()
    password = user_dict.pop("password")
    hashed_password = hash_password(password)
    
    user = User(**user_dict)
    doc = user.model_dump()
    doc["password"] = hashed_password
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.users.insert_one(doc)
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user.pop("password")
    if isinstance(user["created_at"], str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    user_obj = User(**user)
    token = create_access_token({"sub": user_obj.id})
    return Token(access_token=token, token_type="bearer", user=user_obj)

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        if isinstance(u["created_at"], str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return users

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    # Prevent users from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Only admins can delete users
    if current_user.role != "yönetici":
        raise HTTPException(status_code=403, detail="Only administrators can delete users")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}



# Product endpoints
@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    existing = await db.products.find_one({"barcode": product_data.barcode})
    if existing:
        raise HTTPException(status_code=400, detail="Barkod zaten mevcut")
    
    product_dict = product_data.model_dump()
    image_base64 = product_dict.pop("image_base64", None)
    
    product = Product(**product_dict)
    if image_base64:
        product.image_url = image_base64
    
    doc = product.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.products.insert_one(doc)
    return product

@api_router.post("/products/generate-description")
async def generate_description(data: dict, current_user: User = Depends(get_current_user)):
    try:
        product_info = f"Ürün Adı: {data.get('name', '')}\nMarka: {data.get('brand', '')}\nKategori: {data.get('category', '')}"
        
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="Sen bir medikal ürünler uzmanısın. Kısa, çekici ve detaylı Türkçe ürün açıklamaları yazıyorsun. Maksimum 2-3 cümle."
        ).with_model("gemini", "gemini-2.0-flash")
        
        message = UserMessage(text=f"{product_info}\n\nBu medikal ürün için profesyonel ve çekici bir açıklama yaz (max 2-3 cümle):")
        response = await chat.send_message(message)
        
        return {"description": response}
    except Exception as e:
        logging.error(f"AI description error: {e}")
        return {"description": f"{data.get('name', '')} - {data.get('category', '')} kategorisinde kaliteli bir üründür."}

@api_router.get("/products", response_model=List[Product])
async def get_products(current_user: User = Depends(get_current_user)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    for p in products:
        if isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        if isinstance(p["updated_at"], str):
            p["updated_at"] = datetime.fromisoformat(p["updated_at"])
    return products

@api_router.get("/products/barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(barcode: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    if isinstance(product["created_at"], str):
        product["created_at"] = datetime.fromisoformat(product["created_at"])
    if isinstance(product["updated_at"], str):
        product["updated_at"] = datetime.fromisoformat(product["updated_at"])
    return Product(**product)

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductUpdate, current_user: User = Depends(get_current_user)):
    update_dict = {k: v for k, v in product_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")
    
    if "image_base64" in update_dict:
        update_dict["image_url"] = update_dict.pop("image_base64")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.products.update_one({"id": product_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(product["created_at"], str):
        product["created_at"] = datetime.fromisoformat(product["created_at"])
    if isinstance(product["updated_at"], str):
        product["updated_at"] = datetime.fromisoformat(product["updated_at"])
    return Product(**product)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.get("/products/low-stock")
async def get_low_stock_products(current_user: User = Depends(get_current_user)):
    pipeline = [
        {"$addFields": {"is_low_stock": {"$lte": ["$quantity", "$min_quantity"]}}},
        {"$match": {"is_low_stock": True}},
        {"$project": {"_id": 0}}
    ]
    products = await db.products.aggregate(pipeline).to_list(100)
    for p in products:
        if isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        if isinstance(p["updated_at"], str):
            p["updated_at"] = datetime.fromisoformat(p["updated_at"])
    return products

# Sales endpoints
@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    sale_dict = sale_data.model_dump()
    sale_dict["final_amount"] = sale_dict["total_amount"] - sale_dict["discount"]
    sale_dict["cashier_id"] = current_user.id
    
    sale = Sale(**sale_dict)
    doc = sale.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    # Update product quantities
    for item in sale.items:
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"quantity": -item["quantity"]}}
        )
    
    # Update customer total spent
    if sale.customer_id:
        await db.customers.update_one(
            {"id": sale.customer_id},
            {"$inc": {"total_spent": sale.final_amount}}
        )
    
    await db.sales.insert_one(doc)
    return sale

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if start_date and end_date:
        query["created_at"] = {
            "$gte": datetime.fromisoformat(start_date).isoformat(),
            "$lte": datetime.fromisoformat(end_date).isoformat()
        }
    
    sales = await db.sales.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for s in sales:
        if isinstance(s["created_at"], str):
            s["created_at"] = datetime.fromisoformat(s["created_at"])
    return sales

# Customer endpoints
@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    customer = Customer(**customer_data.model_dump())
    doc = customer.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.customers.insert_one(doc)
    return customer

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    customers = await db.customers.find({"deleted": {"$ne": True}}, {"_id": 0}).to_list(1000)
    for c in customers:
        if isinstance(c["created_at"], str):
            c["created_at"] = datetime.fromisoformat(c["created_at"])
    return customers

@api_router.get("/customers/{customer_id}/purchases")
async def get_customer_purchases(customer_id: str, current_user: User = Depends(get_current_user)):
    sales = await db.sales.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for s in sales:
        if isinstance(s["created_at"], str):
            s["created_at"] = datetime.fromisoformat(s["created_at"])
    return sales

@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer_data: dict, current_user: User = Depends(get_current_user)):
    result = await db.customers.update_one({"id": customer_id}, {"$set": customer_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if isinstance(customer["created_at"], str):
        customer["created_at"] = datetime.fromisoformat(customer["created_at"])
    return customer

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_current_user)):
    # Only admins can delete customers
    if current_user.role != "yönetici":
        raise HTTPException(status_code=403, detail="Sadece yöneticiler müşteri silebilir")
    
    # Soft delete: mark as deleted instead of removing
    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"deleted": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return {"message": "Müşteri silindi"}

@api_router.get("/customers/search")
async def search_customers(
    q: str = Query(..., description="Arama terimi (isim veya telefon)"),
    current_user: User = Depends(get_current_user)
):
    """Müşterileri isim veya telefon numarasına göre arar"""
    search_query = {
        "$and": [
            {"$or": [{"deleted": {"$exists": False}}, {"deleted": False}]},
            {
                "$or": [
                    {"name": {"$regex": q, "$options": "i"}},
                    {"phone": {"$regex": q, "$options": "i"}}
                ]
            }
        ]
    }
    
    customers = await db.customers.find(search_query, {"_id": 0}).to_list(100)
    return customers

# Reports endpoints
@api_router.get("/reports/top-selling")
async def get_top_selling(
    start_date: str,
    end_date: str,
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": datetime.fromisoformat(start_date).isoformat(),
                    "$lte": datetime.fromisoformat(end_date).isoformat()
                }
            }
        },
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.product_id",
                "product_name": {"$first": "$items.name"},
                "total_quantity": {"$sum": "$items.quantity"},
                "total_revenue": {"$sum": "$items.total"}
            }
        },
        {"$sort": {"total_quantity": -1}},
        {"$limit": limit}
    ]
    
    results = await db.sales.aggregate(pipeline).to_list(limit)
    return results

@api_router.get("/reports/top-profit")
async def get_top_profit(
    start_date: str,
    end_date: str,
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    sales = await db.sales.find({
        "created_at": {
            "$gte": datetime.fromisoformat(start_date).isoformat(),
            "$lte": datetime.fromisoformat(end_date).isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    product_profits = {}
    for sale in sales:
        for item in sale["items"]:
            product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
            if product:
                profit = (item["price"] - product["purchase_price"]) * item["quantity"]
                if item["product_id"] in product_profits:
                    product_profits[item["product_id"]]["total_profit"] += profit
                    product_profits[item["product_id"]]["total_quantity"] += item["quantity"]
                else:
                    product_profits[item["product_id"]] = {
                        "product_name": item["name"],
                        "total_profit": profit,
                        "total_quantity": item["quantity"]
                    }
    
    sorted_profits = sorted(product_profits.items(), key=lambda x: x[1]["total_profit"], reverse=True)[:limit]
    return [{"product_id": k, **v} for k, v in sorted_profits]

@api_router.get("/products/filters")
async def get_product_filters(current_user: User = Depends(get_current_user)):
    """Ürünlerden benzersiz marka ve kategori listesini döndürür"""
    brands = await db.products.distinct("brand")
    categories = await db.products.distinct("category")
    
    return {
        "brands": sorted([b for b in brands if b]),  # Boş olmayan markalar
        "categories": sorted([c for c in categories if c])  # Boş olmayan kategoriler
    }

@api_router.get("/reports/stock")
async def get_stock_report(
    brand: Optional[str] = Query(None, description="Marka filtresi"),
    category: Optional[str] = Query(None, description="Kategori filtresi"),
    current_user: User = Depends(get_current_user)
):
    """Stok raporunu filtrelerle birlikte döndürür"""
    query = {}
    
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(10000)
    
    # Stok raporunu hazırla
    report_data = []
    total_value = 0
    total_items = 0
    
    for product in products:
        item_value = product["quantity"] * product["purchase_price"]
        total_value += item_value
        total_items += product["quantity"]
        
        report_data.append({
            "name": product["name"],
            "barcode": product["barcode"],
            "brand": product["brand"],
            "category": product["category"],
            "quantity": product["quantity"],
            "unit_type": product.get("unit_type", "adet"),
            "min_quantity": product["min_quantity"],
            "purchase_price": product["purchase_price"],
            "sale_price": product["sale_price"],
            "stock_value": item_value,
            "status": "Düşük Stok" if product["quantity"] <= product["min_quantity"] else "Normal"
        })
    
    return {
        "products": report_data,
        "summary": {
            "total_products": len(report_data),
            "total_items": total_items,
            "total_value": round(total_value, 2),
            "filters_applied": {
                "brand": brand,
                "category": category
            }
        }
    }

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_products = await db.products.count_documents({})
    low_stock = await db.products.count_documents({"$expr": {"$lte": ["$quantity", "$min_quantity"]}})
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    today_sales = await db.sales.find({
        "created_at": {"$gte": today.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    week_sales = await db.sales.find({
        "created_at": {"$gte": week_ago.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    today_revenue = sum(s["final_amount"] for s in today_sales)
    week_revenue = sum(s["final_amount"] for s in week_sales)
    
    return {
        "total_products": total_products,
        "low_stock_count": low_stock,
        "today_sales_count": len(today_sales),
        "today_revenue": today_revenue,
        "week_sales_count": len(week_sales),
        "week_revenue": week_revenue
    }

# Currency endpoint
currency_cache = {"data": None, "timestamp": None}

@api_router.get("/currency")
async def get_currency_rates():
    global currency_cache
    
    # Cache for 1 hour
    if currency_cache["data"] and currency_cache["timestamp"]:
        if (datetime.now(timezone.utc) - currency_cache["timestamp"]).seconds < 3600:
            return currency_cache["data"]
    
    try:
        async with aiohttp.ClientSession() as session:
            # Get USD/EUR to TRY
            async with session.get("https://api.exchangerate-api.com/v4/latest/TRY") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    rates = data.get("rates", {})
                    
                    usd_try = round(1 / rates.get("USD", 0.03), 2) if rates.get("USD") else 35.50
                    eur_try = round(1 / rates.get("EUR", 0.028), 2) if rates.get("EUR") else 38.20
                else:
                    usd_try = 35.50
                    eur_try = 38.20
            
            # Get Gold and Silver prices in TRY (per gram)
            gold_try = 5400.00  # Updated fallback
            silver_try = 62.50  # Updated fallback
            
            try:
                # Try metalpriceapi.com - base USD to get XAU/XAG in USD, then convert to TRY
                async with session.get("https://api.metalpriceapi.com/v1/latest?base=USD&currencies=XAU,XAG") as metal_resp:
                    if metal_resp.status == 200:
                        metal_data = await metal_resp.json()
                        if metal_data.get("success"):
                            rates_metal = metal_data.get("rates", {})
                            # rates_metal["XAU"] = how many XAU per 1 USD (e.g., 0.000385 XAU per USD)
                            # We need USD per XAU (per troy ounce), so: 1 / rates_metal["XAU"]
                            # Then convert to TRY per gram: (USD_per_ounce * usd_try) / 31.1035
                            
                            if rates_metal.get("XAU"):
                                usd_per_ounce_gold = 1 / rates_metal["XAU"]  # USD per troy ounce
                                gold_try = round((usd_per_ounce_gold * usd_try) / 31.1035, 2)  # TRY per gram
                            
                            if rates_metal.get("XAG"):
                                usd_per_ounce_silver = 1 / rates_metal["XAG"]  # USD per troy ounce
                                silver_try = round((usd_per_ounce_silver * usd_try) / 31.1035, 2)  # TRY per gram
            except Exception as metal_error:
                logging.warning(f"Metal price API error: {metal_error}, using fallback")
            
            result = {
                "usd_try": usd_try,
                "eur_try": eur_try,
                "gold_try": gold_try,
                "silver_try": silver_try,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            currency_cache["data"] = result
            currency_cache["timestamp"] = datetime.now(timezone.utc)
            return result
    except Exception as e:
        logging.error(f"Currency API error: {e}")
    
    # Fallback data
    return {
        "usd_try": 35.50,
        "eur_try": 38.20,
        "gold_try": 3250.00,
        "silver_try": 38.50,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Product price comparison endpoint (SerpAPI Google Shopping)
@api_router.get("/products/{product_id}/price-comparison")
async def get_product_price_comparison(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Search for real product prices using SerpAPI Google Shopping
    Returns top 10 lowest prices from different websites
    """
    # Get product details
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    
    serpapi_key = os.environ.get('SERPAPI_KEY')
    if not serpapi_key:
        raise HTTPException(status_code=500, detail="SerpAPI key bulunamadı")
    
    try:
        # Prepare search query for Turkish market
        search_query = f"{product['brand']} {product['name']}"
        
        # Call SerpAPI Google Shopping
        async with aiohttp.ClientSession() as session:
            params = {
                'engine': 'google_shopping',
                'q': search_query,
                'api_key': serpapi_key,
                'gl': 'tr',  # Turkey
                'hl': 'tr',  # Turkish language
                'num': 20    # Get more results to filter
            }
            
            serpapi_url = 'https://serpapi.com/search.json'
            
            try:
                async with session.get(serpapi_url, params=params, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        
                        results = []
                        shopping_results = data.get('shopping_results', [])
                        
                        for item in shopping_results[:20]:  # Process up to 20 items
                            try:
                                # Extract price - handle different price formats
                                price_str = item.get('price', '0')
                                # Remove currency symbols and commas
                                price_str = price_str.replace('₺', '').replace('TL', '').replace('.', '').replace(',', '.').strip()
                                price = float(price_str)
                                
                                # Extract source/site name
                                source = item.get('source', 'Bilinmeyen')
                                
                                # Get product link
                                link = item.get('link', '#')
                                
                                # Check if in stock
                                delivery = item.get('delivery', '')
                                available = 'stok' not in delivery.lower() or 'mevcut' in delivery.lower()
                                
                                results.append({
                                    'site': source,
                                    'price': round(price, 2),
                                    'url': link,
                                    'available': available,
                                    'title': item.get('title', '')
                                })
                            except (ValueError, TypeError) as e:
                                logging.warning(f"Price parsing error: {e}")
                                continue
                        
                        # Sort by price
                        results.sort(key=lambda x: x['price'])
                        
                        # Get top 10 lowest prices
                        top_results = results[:10]
                        
                        if len(top_results) > 0:
                            return {
                                'product_id': product['id'],
                                'product_name': product['name'],
                                'brand': product['brand'],
                                'category': product['category'],
                                'current_price': product['sale_price'],
                                'barcode': product.get('barcode', ''),
                                'price_results': top_results,
                                'result_count': len(top_results),
                                'source': 'SerpAPI Google Shopping'
                            }
                    else:
                        logging.error(f"SerpAPI error: Status {resp.status}")
                        
            except asyncio.TimeoutError:
                logging.error("SerpAPI timeout")
            except Exception as e:
                logging.error(f"SerpAPI request error: {e}")
        
        # Fallback: If SerpAPI fails, provide search links to major sites
        major_sites = [
            {'site': 'Hepsiburada', 'base_url': 'https://www.hepsiburada.com/ara?q='},
            {'site': 'Trendyol', 'base_url': 'https://www.trendyol.com/sr?q='},
            {'site': 'N11', 'base_url': 'https://www.n11.com/arama?q='},
            {'site': 'Amazon TR', 'base_url': 'https://www.amazon.com.tr/s?k='},
            {'site': 'GittiGidiyor', 'base_url': 'https://www.gittigidiyor.com/arama/?k='},
            {'site': 'Çiçeksepeti', 'base_url': 'https://www.ciceksepeti.com/ara?q='},
            {'site': 'Akakçe', 'base_url': 'https://www.akakce.com/arama/?q='},
            {'site': 'Cimri', 'base_url': 'https://www.cimri.com/arama?q='},
            {'site': 'Epttavm', 'base_url': 'https://www.epttavm.com/arama?q='},
            {'site': 'Google Shopping', 'base_url': 'https://www.google.com/search?tbm=shop&q='}
        ]
        
        search_term = f"{product['brand']}+{product['name']}".replace(' ', '+')
        fallback_results = []
        
        for site_info in major_sites:
            fallback_results.append({
                'site': site_info['site'],
                'price': product['sale_price'],
                'url': site_info['base_url'] + search_term,
                'available': True,
                'title': f"{product['name']} - Manuel arama"
            })
        
        return {
            'product_id': product['id'],
            'product_name': product['name'],
            'brand': product['brand'],
            'category': product['category'],
            'current_price': product['sale_price'],
            'barcode': product.get('barcode', ''),
            'price_results': fallback_results[:10],
            'result_count': len(fallback_results[:10]),
            'source': 'Manuel Arama (SerpAPI mevcut değil)',
            'info': 'Gerçek fiyatlar için siteleri ziyaret edin'
        }
            
    except Exception as e:
        logging.error(f"Price comparison error: {e}")
        raise HTTPException(status_code=500, detail=f"Fiyat karşılaştırması hatası: {str(e)}")

# Calendar endpoints
@api_router.post("/calendar", response_model=CalendarEvent)
async def create_calendar_event(event_data: CalendarEventCreate, current_user: User = Depends(get_current_user)):
    event_dict = event_data.model_dump()
    event_dict["user_id"] = current_user.id
    
    event = CalendarEvent(**event_dict)
    doc = event.model_dump()
    doc["date"] = doc["date"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.calendar_events.insert_one(doc)
    return event

@api_router.get("/calendar", response_model=List[CalendarEvent])
async def get_calendar_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"user_id": current_user.id}
    if start_date and end_date:
        query["date"] = {
            "$gte": datetime.fromisoformat(start_date).isoformat(),
            "$lte": datetime.fromisoformat(end_date).isoformat()
        }
    
    events = await db.calendar_events.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    for e in events:
        if isinstance(e["date"], str):
            e["date"] = datetime.fromisoformat(e["date"])
        if isinstance(e["created_at"], str):
            e["created_at"] = datetime.fromisoformat(e["created_at"])
    return events

@api_router.delete("/calendar/{event_id}")
async def delete_calendar_event(event_id: str, current_user: User = Depends(get_current_user)):
    result = await db.calendar_events.delete_one({"id": event_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}

# Test data seeding endpoint
@api_router.post("/admin/seed-test-data")
async def seed_test_data(current_user: User = Depends(get_current_user)):
    """Seed database with test data: 5 medical products, 5 customers, 5 events"""
    if current_user.role != "yönetici":
        raise HTTPException(status_code=403, detail="Sadece yöneticiler test verileri ekleyebilir")
    
    # 5 medikal ürünler
    medical_products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Dijital Tansiyon Aleti",
            "barcode": "8691234567890",
            "brand": "Omron",
            "category": "Medikal Cihaz",
            "quantity": 15,
            "min_quantity": 5,
            "purchase_price": 350.00,
            "sale_price": 499.00,
            "description": "Otomatik dijital tansiyon ölçüm cihazı, koldan ölçüm, hafızalı",
            "unit_type": "adet",
            "created_at": datetime.now(timezone.utc),
            "image_url": ""
        },
        {
            "id": str(uuid.uuid4()),
            "name": "İnfrared Ateş Ölçer",
            "barcode": "8691234567891",
            "brand": "Braun",
            "category": "Medikal Cihaz",
            "quantity": 8,
            "min_quantity": 10,
            "purchase_price": 180.00,
            "sale_price": 289.00,
            "description": "Temassız infrared termometre, hızlı ve hassas ölçüm",
            "unit_type": "adet",
            "created_at": datetime.now(timezone.utc),
            "image_url": ""
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Steril Eldiven",
            "barcode": "8691234567892",
            "brand": "Medline",
            "category": "Medikal Sarf",
            "quantity": 50,
            "min_quantity": 20,
            "purchase_price": 25.00,
            "sale_price": 45.00,
            "description": "Lateks steril eldiven, tek kullanımlık, medium boy",
            "unit_type": "kutu",
            "package_quantity": 100,
            "created_at": datetime.now(timezone.utc),
            "image_url": ""
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Nebulizatör Cihazı",
            "barcode": "8691234567893",
            "brand": "Beurer",
            "category": "Medikal Cihaz",
            "quantity": 3,
            "min_quantity": 5,
            "purchase_price": 420.00,
            "sale_price": 649.00,
            "description": "Kompresörlü nebulizatör, solunum tedavisi için",
            "unit_type": "adet",
            "created_at": datetime.now(timezone.utc),
            "image_url": ""
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Kan Şekeri Test Çubuğu",
            "barcode": "8691234567894",
            "brand": "Accu-Chek",
            "category": "Medikal Sarf",
            "quantity": 25,
            "min_quantity": 15,
            "purchase_price": 85.00,
            "sale_price": 135.00,
            "description": "50 adet test çubuğu, glikoz ölçümü için",
            "unit_type": "kutu",
            "package_quantity": 50,
            "created_at": datetime.now(timezone.utc),
            "image_url": ""
        }
    ]
    
    # 5 müşteriler
    customers = [
        {
            "id": str(uuid.uuid4()),
            "name": "Ayşe Yılmaz",
            "phone": "05321234567",
            "email": "ayse.yilmaz@email.com",
            "address": "Kadıköy, İstanbul",
            "notes": "Kurumsal müşteri, aylık sipariş",
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mehmet Demir",
            "phone": "05339876543",
            "email": "mehmet.demir@email.com",
            "address": "Çankaya, Ankara",
            "notes": "Toptan alım yapar",
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Fatma Şahin",
            "phone": "05447891234",
            "email": "fatma.sahin@email.com",
            "address": "Konak, İzmir",
            "notes": "Perakende müşteri",
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ali Kara",
            "phone": "05551234567",
            "email": "ali.kara@email.com",
            "address": "Nilüfer, Bursa",
            "notes": "Kurumsal anlaşma var",
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Zeynep Arslan",
            "phone": "05667894561",
            "email": "zeynep.arslan@email.com",
            "address": "Seyhan, Adana",
            "notes": "Aylık düzenli alım",
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    # 5 etkinlikler (önümüzdeki günlerde)
    today = datetime.now(timezone.utc)
    events = [
        {
            "id": str(uuid.uuid4()),
            "title": "Stok Sayımı",
            "description": "Aylık rutin stok sayımı yapılacak",
            "date": (today + timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0),
            "alarm": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Tedarikçi Toplantısı",
            "description": "Yeni medikal ürün tedarikçisi ile görüşme",
            "date": (today + timedelta(days=5)).replace(hour=14, minute=30, second=0, microsecond=0),
            "alarm": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Fiyat Güncellemesi",
            "description": "Mevsimsel fiyat güncellemelerini uygula",
            "date": (today + timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0),
            "alarm": False,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Müşteri Ziyareti",
            "description": "Büyük müşteri için tanıtım sunumu",
            "date": (today + timedelta(days=10)).replace(hour=15, minute=0, second=0, microsecond=0),
            "alarm": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Ürün Eğitimi",
            "description": "Yeni nebulizatör cihazları için personel eğitimi",
            "date": (today + timedelta(days=14)).replace(hour=11, minute=0, second=0, microsecond=0),
            "alarm": False,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    # Insert data
    await db.products.insert_many(medical_products)
    await db.customers.insert_many(customers)
    await db.calendar.insert_many(events)
    
    return {
        "message": "Test verileri başarıyla eklendi",
        "products_added": len(medical_products),
        "customers_added": len(customers),
        "events_added": len(events)
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_create_admin():
    """Create default admin user if not exists"""
    try:
        # Check if admin user exists
        existing_admin = await db.users.find_one({"username": "admin"})
        
        if not existing_admin:
            # Create admin user
            admin_password = "Admin123!"  # Strong default password
            hashed_password = pwd_context.hash(admin_password)
            
            admin_user = {
                "id": str(uuid.uuid4()),
                "username": "admin",
                "email": "admin@stokcrm.com",
                "password": hashed_password,
                "role": "yönetici",
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.users.insert_one(admin_user)
            logger.info("✅ Admin kullanıcı oluşturuldu!")
            logger.info(f"   Kullanıcı Adı: admin")
            logger.info(f"   Şifre: {admin_password}")
            logger.info(f"   Email: admin@stokcrm.com")
            logger.info(f"   Rol: yönetici")
        else:
            logger.info("ℹ️  Admin kullanıcı zaten mevcut")
    except Exception as e:
        logger.error(f"❌ Admin kullanıcı oluşturulurken hata: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()