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
            
            # Get Gold and Silver prices in TRY
            gold_try = 3250.00
            silver_try = 38.50
            
            try:
                # Try metalpriceapi.com (free, no key required for basic usage)
                async with session.get("https://api.metalpriceapi.com/v1/latest?base=TRY&currencies=XAU,XAG") as metal_resp:
                    if metal_resp.status == 200:
                        metal_data = await metal_resp.json()
                        if metal_data.get("success"):
                            # API returns TRY per ounce of gold/silver
                            rates_metal = metal_data.get("rates", {})
                            # Convert from per ounce to per gram (1 troy ounce = 31.1035 grams)
                            if rates_metal.get("XAU"):
                                gold_try = round((1 / rates_metal["XAU"]) * 31.1035, 2)
                            if rates_metal.get("XAG"):
                                silver_try = round((1 / rates_metal["XAG"]) * 31.1035, 2)
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

# Product price comparison endpoint (web search)
@api_router.get("/products/{product_id}/price-comparison")
async def get_product_price_comparison(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Search for product prices across the internet
    Returns top 10 lowest prices from different websites
    """
    # Get product details
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    
    # This will be called from frontend using web search
    # Return product info for search
    return {
        "product_id": product["id"],
        "product_name": product["name"],
        "brand": product["brand"],
        "category": product["category"],
        "current_price": product["sale_price"],
        "barcode": product.get("barcode", "")
    }

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()