import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  Share as NativeShare,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { generatePDF } from "react-native-html-to-pdf";
import RNShare from "react-native-share";
import { captureRef } from "react-native-view-shot";

const NAVY = "#082653";
const PAGE = "#f5f7fb";
const CARD = "#ffffff";
const LINE = "#e5eaf0";
const MUTED = "#667085";
const GREEN = "#22c55e";

const defaultItemCategories = [
  "Breakfast",
  "Meals",
  "Biryani",
  "Starters",
  "Chinese",
  "Tiffins",
  "Tea",
  "Coffee",
  "Juices",
  "Desserts"
];
const registeredCanteen = {
  name: "Main Canteen",
  logoUri: ""
};

type Category = string;
type BottomNavItem = "Home" | "Orders" | "Reports" | "Settings";
type PaymentMode = "Online" | "Cash" | "Split" | "Credit";
type OrderDraft = [string, string, string, string];
type DrawerOption =
  | "Dashboard"
  | "New Billing"
  | "Admin Panel"
  | "Orders"
  | "Reports"
  | "Finance"
  | "Store"
  | "Expenses"
  | "Today's Sales"
  | "Cash Summary"
  | "Add Item"
  | "Edit Price"
  | "Categories"
  | "Stock Availability"
  | "Printer Settings"
  | "User"
  | "Settings"
  | "Sync Data"
  | "Logout";

type DrawerSection = {
  title: "SALES" | "ADMIN" | "ITEMS" | "SETTINGS";
  items: DrawerOption[];
};

const drawerSections: DrawerSection[] = [
  {
    title: "SALES",
    items: ["Dashboard", "New Billing", "Orders", "Today's Sales", "Cash Summary"]
  },
  {
    title: "ADMIN",
    items: ["Admin Panel", "Reports", "Finance", "Store", "Expenses"]
  },
  {
    title: "ITEMS",
    items: ["Add Item", "Edit Price", "Categories", "Stock Availability"]
  },
  {
    title: "SETTINGS",
    items: ["Printer Settings", "User", "Settings", "Sync Data"]
  }
];

type Product = {
  id: string;
  name: string;
  price: number;
  category: Category;
  image: string;
  hidden?: boolean;
  subItems?: string[];
};

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
};

type StorePurchase = {
  id: string;
  date: string;
  vendor: string;
  vendorAddress: string;
  vendorPhone: string;
  item: string;
  category: string;
  quantity: number;
  unit: "Kgs" | "Pcs" | "Ltrs";
  price: number;
};

type StoreUsage = {
  id: string;
  date: string;
  item: string;
  category: string;
  quantity: number;
  unit: "Kgs" | "Pcs" | "Ltrs";
};

type PurchaseDraftItem = {
  id: string;
  item: string;
  category: string;
  customCategory: string;
  quantity: string;
  unit: "Kgs" | "Pcs" | "Ltrs";
  price: string;
};

type SuperAdminSettings = {
  showProfitToCanteen: boolean;
  openAdminDashboardFirst: boolean;
};

const defaultExpenses: Expense[] = [
  { id: "e1", date: formatDateInput(new Date()), category: "Raw Material", amount: 1850, note: "Vegetables and rice" },
  { id: "e2", date: formatDateInput(new Date()), category: "Staff", amount: 420, note: "Staff meals" },
  { id: "e3", date: formatDateInput(new Date()), category: "Packing", amount: 260, note: "Cups and parcels" },
  { id: "e4", date: formatDateInput(new Date()), category: "Maintenance", amount: 300, note: "Cleaning supplies" }
];

const paymentModeOptions: {
  id: PaymentMode;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
}[] = [
  { id: "Online", title: "Online", subtitle: "UPI / GPay / PhonePe", color: "#2563eb", bg: "#eff6ff" },
  { id: "Cash", title: "Cash", subtitle: "Cash payment", color: "#16a34a", bg: "#ecfdf3" },
  { id: "Split", title: "Split", subtitle: "Cash + Online", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "Credit", title: "Credit", subtitle: "Pending amount", color: "#f59e0b", bg: "#fffbeb" }
];

const products: Product[] = [
  {
    id: "1",
    name: "Chicken Pakodi",
    price: 50,
    category: "Meals",
    subItems: ["Full plate", "Half plate", "Extra spicy"],
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "2",
    name: "Tea",
    price: 15,
    category: "Tea",
    subItems: ["Regular", "Strong", "Less sugar"],
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "3",
    name: "Meals",
    price: 80,
    category: "Meals",
    subItems: ["Rice", "Dal", "Curry", "Curd"],
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "4",
    name: "Idly",
    price: 30,
    category: "Tiffins",
    image: "https://images.unsplash.com/photo-1630409351241-e90e7f5e434d?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "5",
    name: "Dosa",
    price: 40,
    category: "Tiffins",
    subItems: ["Plain dosa", "Masala dosa", "Onion dosa"],
    image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "6",
    name: "Coffee",
    price: 20,
    category: "Tea",
    subItems: ["Regular", "Strong", "Less sugar"],
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80"
  }
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 720;
  const columns = isTablet ? 4 : 2;
  const horizontalPadding = isTablet ? 24 : 16;
  const cardGap = 12;
  const productWidth = useMemo(
    () => (width - horizontalPadding * 2 - cardGap * (columns - 1)) / columns,
    [columns, horizontalPadding, width]
  );

  const [activeCategory, setActiveCategory] = useState("All");
  const [cartCount, setCartCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOption, setActiveOption] = useState<DrawerOption>("New Billing");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [catalog, setCatalog] = useState<Product[]>(products);
  const [appCategories, setAppCategories] = useState<string[]>(defaultItemCategories);
  const [superAdminSettings, setSuperAdminSettings] = useState<SuperAdminSettings>({
    showProfitToCanteen: false,
    openAdminDashboardFirst: false
  });
  const [expenses, setExpenses] = useState<Expense[]>(defaultExpenses);
  const [storePurchases, setStorePurchases] = useState<StorePurchase[]>([]);
  const [storeUsage, setStoreUsage] = useState<StoreUsage[]>([]);
  const [orderDrafts, setOrderDrafts] = useState<OrderDraft[]>([
    ["#10131", "2 items", "Rs 8,245", "Paid"],
    ["#10122", "1 item", "Rs 235", "Pending"],
    ["#10144", "4 items", "Rs 530", "Paid"]
  ]);
  const drawerProgress = useRef(new Animated.Value(0)).current;

  const categoryTabs = useMemo(() => ["All", ...appCategories], [appCategories]);
  const visibleProducts = useMemo(
    () => catalog.filter(item => !item.hidden && (activeCategory === "All" || item.category === activeCategory)),
    [activeCategory, catalog]
  );

  const addProduct = useCallback((product: Product) => {
    setCartCount(count => count + 1);
    setTotal(amount => amount + product.price);
  }, []);

  const clearCart = useCallback(() => {
    setCartCount(0);
    setTotal(0);
  }, []);

  const openSubItems = useCallback((product: Product) => {
    setSelectedProduct(product);
  }, []);

  const closeSubItems = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true
    }).start();
  }, [drawerProgress]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  }, [drawerProgress]);

  const selectOption = useCallback((option: DrawerOption) => {
    setActiveOption(option);
    closeDrawer();
  }, [closeDrawer]);

  const selectBottomNav = useCallback((item: BottomNavItem) => {
    const nextOption: Record<BottomNavItem, DrawerOption> = {
      Home: superAdminSettings.openAdminDashboardFirst ? "Dashboard" : "New Billing",
      Orders: "Orders",
      Reports: "Reports",
      Settings: "Settings"
    };
    setActiveOption(nextOption[item]);
  }, [superAdminSettings.openAdminDashboardFirst]);

  const showBillingGrid = activeOption === "Dashboard" || activeOption === "New Billing";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={styles.page}>
        <PremiumHeader onMenuPress={openDrawer} />

        {showBillingGrid ? (
          <FlatList
            data={visibleProducts}
            key={columns}
            numColumns={columns}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingHorizontal: horizontalPadding, paddingBottom: 292 }
            ]}
            columnWrapperStyle={columns > 1 ? { gap: cardGap } : undefined}
            ListHeaderComponent={
              <>
                <SearchBar />
                <CategoryTabs categories={categoryTabs} active={activeCategory} onChange={setActiveCategory} />
              </>
            }
            renderItem={({ item }) => (
              <ProductCard product={item} width={productWidth} onPress={addProduct} onLongPress={openSubItems} />
            )}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
          />
        ) : (
          <OptionContent
            option={activeOption}
            horizontalPadding={horizontalPadding}
            products={catalog}
            onProductsChange={setCatalog}
            categories={appCategories}
            onCategoriesChange={setAppCategories}
            expenses={expenses}
            onExpensesChange={setExpenses}
            storePurchases={storePurchases}
            onStorePurchasesChange={setStorePurchases}
            storeUsage={storeUsage}
            onStoreUsageChange={setStoreUsage}
            orderDrafts={orderDrafts}
            onOrderDraftsChange={setOrderDrafts}
            superAdminSettings={superAdminSettings}
            onSuperAdminSettingsChange={setSuperAdminSettings}
          />
        )}

        {showBillingGrid && <CartPanel count={cartCount} total={total} onClear={clearCart} />}
        <BottomNav activeOption={activeOption} onSelect={selectBottomNav} />
        {selectedProduct && <SubItemsSheet product={selectedProduct} onClose={closeSubItems} />}
        {drawerOpen && (
          <Drawer
            width={Math.min(width * 0.82, 340)}
            progress={drawerProgress}
            onClose={closeDrawer}
            activeOption={activeOption}
            onSelect={selectOption}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Header({ onMenuPress }: { onMenuPress: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.menuButton} activeOpacity={0.8} onPress={onMenuPress}>
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>

      <View style={styles.logo}>
        <Text style={styles.logoIcon}>♨</Text>
      </View>

      <View style={styles.headerTitle}>
        <View style={styles.headerNameRow}>
          <Text style={styles.title}>Main Canteen</Text>
          <View style={styles.statusRow}>
            <Text style={styles.connected}>Connected</Text>
          </View>
        </View>
      </View>

    </View>
  );
}

function PremiumHeader({
  onMenuPress,
  canteenName = registeredCanteen.name,
  logoUri = registeredCanteen.logoUri
}: {
  onMenuPress: () => void;
  canteenName?: string;
  logoUri?: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.decorCutlery}>🍴</Text>
      <TouchableOpacity style={styles.menuButton} activeOpacity={0.8} onPress={onMenuPress}>
        <View style={styles.menuBars}>
          <View style={styles.menuBar} />
          <View style={styles.menuBar} />
          <View style={styles.menuBar} />
        </View>
      </TouchableOpacity>

      <View style={styles.logo}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logoImage} />
        ) : (
          <Text style={styles.logoIcon}>🍴</Text>
        )}
      </View>

      <View style={styles.headerTitle}>
        <Text style={styles.title} numberOfLines={1}>
          {canteenName.toUpperCase()}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.connected}>Online</Text>
        </View>
      </View>
    </View>
  );
}

function Drawer({
  width,
  progress,
  onClose,
  activeOption,
  onSelect
}: {
  width: number;
  progress: Animated.Value;
  onClose: () => void;
  activeOption: DrawerOption;
  onSelect: (option: DrawerOption) => void;
}) {
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, 0]
  });
  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.56]
  });

  return (
    <View style={styles.drawerLayer} pointerEvents="box-none">
      <Animated.View style={[styles.drawerOverlay, { opacity: overlayOpacity }]}>
        <Pressable style={styles.overlayPressable} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width, transform: [{ translateX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerScroll}>
          <View style={styles.drawerTop}>
            <View style={styles.drawerLogo}>
              <Text style={styles.drawerLogoIcon}>♨</Text>
            </View>
            <View style={styles.drawerTitleBlock}>
              <Text style={styles.drawerTitle}>Main Canteen</Text>
              <View style={styles.drawerMetaRow}>
                <View style={styles.drawerStatus}>
          <Text style={styles.connected}>Online</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.cashierIcon}>
              <Text style={styles.cashierIconText}>C</Text>
            </View>
            <View style={styles.profileTextBlock}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>Cashier Name</Text>
                <View style={styles.onlineBadge}>
                  <Text style={styles.onlineBadgeText}>Online</Text>
                </View>
              </View>
            </View>
          </View>

          {drawerSections.map(section => (
            <View key={section.title} style={styles.drawerSection}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, index) => {
                  const selected = item === activeOption;
                  return (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.86}
                      onPress={() => onSelect(item)}
                      style={[
                        styles.drawerItem,
                        selected && styles.drawerItemSelected,
                        index !== section.items.length - 1 && styles.drawerItemDivider
                      ]}
                    >
                      <View style={[styles.drawerItemIcon, selected && styles.drawerItemIconSelected]}>
                        <Text style={[styles.drawerItemIconText, selected && styles.drawerItemIconTextSelected]}>
                          {item.slice(0, 1)}
                        </Text>
                      </View>
                      <Text style={[styles.drawerItemText, selected && styles.drawerItemTextSelected]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.drawerBottom}>
          <TouchableOpacity activeOpacity={0.86} style={styles.logoutButton} onPress={() => onSelect("Logout")}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>App Version 1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function SearchBar() {
  return (
    <View style={styles.searchBar}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        placeholder="Search item / code"
        placeholderTextColor="#8a94a6"
        style={styles.searchInput}
      />
    </View>
  );
}

function OptionContent({
  option,
  horizontalPadding,
  products,
  onProductsChange,
  categories,
  onCategoriesChange,
  expenses,
  onExpensesChange,
  storePurchases,
  onStorePurchasesChange,
  storeUsage,
  onStoreUsageChange,
  orderDrafts,
  onOrderDraftsChange,
  superAdminSettings,
  onSuperAdminSettingsChange
}: {
  option: DrawerOption;
  horizontalPadding: number;
  products: Product[];
  onProductsChange: (next: Product[]) => void;
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
  expenses: Expense[];
  onExpensesChange: (next: Expense[]) => void;
  storePurchases: StorePurchase[];
  onStorePurchasesChange: (next: StorePurchase[]) => void;
  storeUsage: StoreUsage[];
  onStoreUsageChange: (next: StoreUsage[]) => void;
  orderDrafts: OrderDraft[];
  onOrderDraftsChange: (next: OrderDraft[]) => void;
  superAdminSettings: SuperAdminSettings;
  onSuperAdminSettingsChange: (next: SuperAdminSettings) => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.optionContent, { paddingHorizontal: horizontalPadding, paddingBottom: 184 }]}
    >
      <Text style={styles.optionTitle}>{option}</Text>
      {option === "Orders" && <OrdersScreen orders={orderDrafts} onOrdersChange={onOrderDraftsChange} />}
      {option === "Admin Panel" && <AdminPanelScreen products={products} expenses={expenses} showProfit={superAdminSettings.showProfitToCanteen} />}
      {option === "Reports" && <ReportsScreen products={products} expenses={expenses} showProfit={superAdminSettings.showProfitToCanteen} />}
      {option === "Finance" && <FinanceScreen products={products} expenses={expenses} onExpensesChange={onExpensesChange} showProfit={superAdminSettings.showProfitToCanteen} />}
      {option === "Store" && (
        <StoreScreen
          expenses={expenses}
          onExpensesChange={onExpensesChange}
          purchases={storePurchases}
          onPurchasesChange={onStorePurchasesChange}
          usage={storeUsage}
          onUsageChange={onStoreUsageChange}
        />
      )}
      {option === "Expenses" && <ExpensesScreen expenses={expenses} onExpensesChange={onExpensesChange} />}
      {option === "Today's Sales" && <TodaysSalesScreen />}
      {option === "Cash Summary" && <CashSummaryScreen />}
      {option === "Add Item" && <ItemManagerScreen products={products} onProductsChange={onProductsChange} categories={categories} onCategoriesChange={onCategoriesChange} />}
      {option === "Edit Price" && <ItemManagerScreen products={products} onProductsChange={onProductsChange} categories={categories} onCategoriesChange={onCategoriesChange} />}
      {option === "Categories" && <CategoryManagerScreen categories={categories} onCategoriesChange={onCategoriesChange} />}
      {option === "Stock Availability" && <StockAvailabilityScreen products={products} />}
      {option === "Printer Settings" && <PrinterSettingsScreen />}
      {option === "User" && <UserScreen />}
      {option === "Settings" && <SettingsScreen settings={superAdminSettings} onSettingsChange={onSuperAdminSettingsChange} />}
      {option === "Sync Data" && <SyncDataScreen />}
      {option === "Logout" && <LogoutScreen />}
    </ScrollView>
  );
}

function OrdersScreen({
  orders,
  onOrdersChange
}: {
  orders: OrderDraft[];
  onOrdersChange: (next: OrderDraft[]) => void;
}) {
  const [bulkEntry, setBulkEntry] = useState("");

  const addBulkOrder = () => {
    const lines = bulkEntry.split("\n").map(line => line.trim()).filter(Boolean);
    if (!lines.length) return;
    onOrdersChange([[`#${Date.now().toString().slice(-5)}`, `${lines.length} entries`, "Bulk", "Draft"], ...orders]);
    setBulkEntry("");
  };

  return (
    <View style={styles.optionStack}>
      <View style={styles.formCard}>
        <Text style={styles.summaryTitle}>Bulk Order Entry</Text>
        <TextInput
          value={bulkEntry}
          onChangeText={setBulkEntry}
          multiline
          placeholder={"Example:\nTea x 4\nMeals x 2\nDosa x 3"}
          placeholderTextColor="#8a94a6"
          style={[styles.realInput, styles.bulkInput]}
        />
        <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={addBulkOrder}>
          <Text style={styles.primaryActionText}>Add Bulk Order</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.86} style={styles.secondaryAction} onPress={() => onOrdersChange([])}>
          <Text style={styles.secondaryActionText}>Clear Orders</Text>
        </TouchableOpacity>
      </View>

      {orders.map(row => (
        <View key={row[0]} style={styles.listCard}>
          <View>
            <Text style={styles.listTitle}>{row[0]}</Text>
            <Text style={styles.listSub}>20:13 • {row[1]}</Text>
          </View>
          <View style={styles.rightInfo}>
            <Text style={styles.listAmount}>{row[2]}</Text>
            <Text style={styles.badgeText}>{row[3]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

type ReportRange = "Today" | "Week" | "Month" | "Year" | "Custom";

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildRange(range: ReportRange, fromDate: string, toDate: string): [string, string] {
  const today = new Date();
  const start = new Date(today);
  if (range === "Week") start.setDate(today.getDate() - 6);
  if (range === "Month") start.setDate(1);
  if (range === "Year") {
    start.setMonth(0);
    start.setDate(1);
  }
  if (range === "Custom") return [fromDate, toDate];
  return [formatDateInput(start), formatDateInput(today)];
}

function isDateInRange(date: string, fromDate: string, toDate: string) {
  return date >= fromDate && date <= toDate;
}

function buildReportSummary(products: Product[], expenses: Expense[] = defaultExpenses, rangeDates?: [string, string]) {
  const itemReports = products.filter(item => !item.hidden).map((item, index) => {
    const quantity = (index + 2) * 4;
    const discount = index % 2 === 0 ? 10 : 0;
    const gross = quantity * item.price;
    const cost = Math.round(gross * (item.category === "Tea" ? 0.38 : 0.58));
    return {
      ...item,
      quantity,
      gross,
      discount,
      cost,
      net: gross - discount,
      profit: gross - discount - cost
    };
  });
  const totalSales = itemReports.reduce((sum, item) => sum + item.net, 0);
  const totalQty = itemReports.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = itemReports.reduce((sum, item) => sum + item.cost, 0);
  const filteredExpenses = rangeDates
    ? expenses.filter(item => isDateInRange(item.date, rangeDates[0], rangeDates[1]))
    : expenses;
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const profit = totalSales - totalCost - totalExpenses;
  return { itemReports, totalSales, totalQty, totalCost, expenses: filteredExpenses, totalExpenses, profit };
}

function AdminPanelScreen({ products, expenses, showProfit }: { products: Product[]; expenses: Expense[]; showProfit: boolean }) {
  const summary = useMemo(() => buildReportSummary(products, expenses), [expenses, products]);
  const lowStock = Math.max(1, Math.round(products.filter(item => !item.hidden).length / 3));

  return (
    <View style={styles.optionStack}>
      <View style={styles.adminHero}>
        <Text style={styles.adminHeroTitle}>Admin Control Room</Text>
        <Text style={styles.adminHeroSub}>Sales, billing, stock, users, expenses, and reports</Text>
      </View>
      <View style={styles.reportGrid}>
        <ReportMetric label="Today Sales" value={`Rs ${summary.totalSales}`} />
        <ReportMetric label="Bills" value={String(Math.max(summary.totalQty, 1))} />
        <ReportMetric label="Expenses" value={`Rs ${summary.totalExpenses}`} />
        {showProfit && <ReportMetric label={summary.profit >= 0 ? "Profit" : "Loss"} value={`Rs ${Math.abs(summary.profit)}`} />}
      </View>
      <ReportSection title="Admin Modules">
        <ReportRow label="Billing" value="Ready" detail="New bill, cart, payments" />
        <ReportRow label="Reports" value="Clear" detail="Today, week, month, year, custom date" />
        <ReportRow label="Inventory" value={`${lowStock} low`} detail="Stock and price management" />
        <ReportRow label="Users" value="2 active" detail="Admin and cashier control" />
      </ReportSection>
      <ReportsScreen products={products} expenses={expenses} compact showProfit={showProfit} />
    </View>
  );
}

function ReportsScreen({
  products,
  expenses,
  compact = false,
  showProfit = true
}: {
  products: Product[];
  expenses: Expense[];
  compact?: boolean;
  showProfit?: boolean;
}) {
  const reportCardRef = useRef<View | null>(null);
  const initialToday = formatDateInput(new Date());
  const [range, setRange] = useState<ReportRange>("Today");
  const [fromDate, setFromDate] = useState(initialToday);
  const [toDate, setToDate] = useState(initialToday);
  const [shareStatus, setShareStatus] = useState("");

  const activeRange = buildRange(range, fromDate, toDate);
  const summary = useMemo(() => buildReportSummary(products, expenses, activeRange), [activeRange, expenses, products]);
  const { itemReports, totalSales, totalQty, totalCost, expenses: reportExpenses, totalExpenses, profit } = summary;
  const avgBill = Math.round(totalSales / Math.max(itemReports.length, 1));
  const cash = Math.round(totalSales * 0.52);
  const upi = Math.round(totalSales * 0.38);
  const card = totalSales - cash - upi;
  const discount = itemReports.reduce((sum, item) => sum + item.discount, 0);

  const categoryNames = Array.from(new Set(products.filter(item => !item.hidden).map(item => item.category)));
  const categoryReports = categoryNames.map(category => {
    const rows = itemReports.filter(item => item.category === category);
    return {
      label: category,
      qty: rows.reduce((sum, item) => sum + item.quantity, 0),
      amount: rows.reduce((sum, item) => sum + item.net, 0)
    };
  });

  const dailyReports = [
    [activeRange[0], `Rs ${Math.round(totalSales * 0.78)}`, `${Math.round(totalQty * 0.7)} qty`],
    [activeRange[1], `Rs ${totalSales}`, `${totalQty} qty`]
  ];

  const hourlyReports = [
    ["07-09 AM", "Breakfast", `Rs ${Math.round(totalSales * 0.22)}`],
    ["09-12 PM", "Tea Rush", `Rs ${Math.round(totalSales * 0.16)}`],
    ["12-03 PM", "Lunch", `Rs ${Math.round(totalSales * 0.42)}`],
    ["03-06 PM", "Snacks", `Rs ${Math.round(totalSales * 0.2)}`]
  ];

  const reportMessage = [
    `${registeredCanteen.name} ${range} Report`,
    `Date: ${activeRange[0]} to ${activeRange[1]}`,
    `Total Sales: Rs ${totalSales}`,
    `Bills/Qty: ${totalQty}`,
    `Cash: Rs ${cash}`,
    `UPI/Online: Rs ${upi}`,
    `Card: Rs ${card}`,
    `Expenses: Rs ${totalExpenses}`,
    ...(showProfit ? [`${profit >= 0 ? "Profit" : "Loss"}: Rs ${Math.abs(profit)}`] : [])
  ].join("\n");

  const reportHtml = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { color: #082653; margin-bottom: 6px; }
          .sub { color: #667085; margin-bottom: 22px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #e5eaf0; padding: 10px; text-align: left; font-size: 12px; }
          th { background: #f5f7fb; color: #082653; }
          .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .metric { border: 1px solid #e5eaf0; border-radius: 8px; padding: 12px; }
          .metric strong { display: block; color: #082653; font-size: 20px; }
        </style>
      </head>
      <body>
        <h1>${registeredCanteen.name} ${range} Report</h1>
        <div class="sub">Date: ${activeRange[0]} to ${activeRange[1]}</div>
        <div class="metrics">
          <div class="metric"><strong>Rs ${totalSales}</strong>Total Sale</div>
          <div class="metric"><strong>${totalQty}</strong>Items Sold</div>
          <div class="metric"><strong>Rs ${totalExpenses}</strong>Expenses</div>
          ${showProfit ? `<div class="metric"><strong>Rs ${Math.abs(profit)}</strong>${profit >= 0 ? "Profit" : "Loss"}</div>` : ""}
        </div>
        <table>
          <tr><th>Report</th><th>Value</th><th>Details</th></tr>
          <tr><td>Cash</td><td>Rs ${cash}</td><td>52%</td></tr>
          <tr><td>UPI / Online</td><td>Rs ${upi}</td><td>38%</td></tr>
          <tr><td>Card</td><td>Rs ${card}</td><td>10%</td></tr>
          <tr><td>Food Cost</td><td>Rs ${totalCost}</td><td>Estimated item cost</td></tr>
          <tr><td>Total Expenses</td><td>Rs ${totalExpenses}</td><td>All expenses</td></tr>
          ${showProfit ? `<tr><td>${profit >= 0 ? "Net Profit" : "Net Loss"}</td><td>Rs ${Math.abs(profit)}</td><td>Sales minus cost and expenses</td></tr>` : ""}
        </table>
        <table>
          <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
          ${itemReports.map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>Rs ${item.net}</td></tr>`).join("")}
        </table>
      </body>
    </html>
  `;

  const shareTextFallback = async (type: string) => {
    await NativeShare.share({
      title: `${registeredCanteen.name} ${range} Report`,
      message: `${reportMessage}\n\nFormat selected: ${type}`
    });
  };

  const sharePdfReport = async (target: "PDF" | "WhatsApp") => {
    const file = await generatePDF({
      html: reportHtml,
      fileName: `${registeredCanteen.name.replace(/\s+/g, "-").toLowerCase()}-${range.toLowerCase()}-report`,
      directory: "Documents"
    });
    if (!file.filePath) {
      throw new Error("PDF file path missing");
    }
    const url = file.filePath?.startsWith("file://") ? file.filePath : `file://${file.filePath}`;
    await RNShare.open({
      title: `${registeredCanteen.name} ${range} Report`,
      message: reportMessage,
      url,
      type: "application/pdf",
      failOnCancel: false
    });
    setShareStatus(target === "WhatsApp" ? "PDF ready for WhatsApp" : "PDF report shared");
  };

  const shareImageReport = async () => {
    if (!reportCardRef.current) {
      await shareTextFallback("Image");
      return;
    }
    const uri = await captureRef(reportCardRef, {
      format: "png",
      quality: 0.95,
      result: "tmpfile"
    });
    await RNShare.open({
      title: `${registeredCanteen.name} ${range} Report`,
      message: reportMessage,
      url: uri,
      type: "image/png",
      failOnCancel: false
    });
    setShareStatus("Image report shared");
  };

  const shareReport = async (type: "PDF" | "Image" | "WhatsApp") => {
    setShareStatus(`${type} report preparing...`);
    try {
      if (type === "Image") {
        await shareImageReport();
      } else {
        await sharePdfReport(type);
      }
    } catch {
      await shareTextFallback(type);
      setShareStatus(`${type} shared as text fallback`);
    }
  };

  const applyRange = (nextRange: ReportRange) => {
    const [nextFrom, nextTo] = buildRange(nextRange, fromDate, toDate);
    setRange(nextRange);
    setFromDate(nextFrom);
    setToDate(nextTo);
  };

  return (
    <View style={styles.optionStack}>
      {!compact && (
        <View style={styles.reportHeaderCard}>
          <Text style={styles.adminHeroTitle}>Reports Center</Text>
          <Text style={styles.adminHeroSub}>Sales, payments, expenses, profit/loss and stock reports</Text>
        </View>
      )}

      <View style={styles.reportFilterCard}>
        <View style={styles.dateRow}>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>From Date</Text>
            <TextInput value={fromDate} onChangeText={value => { setRange("Custom"); setFromDate(value); }} style={styles.dateInput} />
          </View>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>To Date</Text>
            <TextInput value={toDate} onChangeText={value => { setRange("Custom"); setToDate(value); }} style={styles.dateInput} />
          </View>
        </View>
        <View style={styles.quickRangeRow}>
          {(["Today", "Week", "Month", "Year", "Custom"] as ReportRange[]).map(item => (
            <TouchableOpacity
              key={item}
              activeOpacity={0.85}
              onPress={() => applyRange(item)}
              style={[styles.quickRangeChip, range === item && styles.quickRangeChipActive]}
            >
              <Text style={[styles.quickRangeText, range === item && styles.quickRangeTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.reportActionRow}>
          <TouchableOpacity style={styles.reportActionButton} onPress={() => shareReport("PDF")} activeOpacity={0.86}>
            <Text style={styles.reportActionText}>Share PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportActionButton} onPress={() => shareReport("Image")} activeOpacity={0.86}>
            <Text style={styles.reportActionText}>Share Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.reportActionButton, styles.whatsappButton]} onPress={() => shareReport("WhatsApp")} activeOpacity={0.86}>
            <Text style={[styles.reportActionText, styles.whatsappButtonText]}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
        {!!shareStatus && <Text style={styles.shareStatus}>{shareStatus}</Text>}
      </View>

      <View ref={reportCardRef} collapsable={false} style={styles.reportCaptureArea}>
        <View style={styles.reportGrid}>
          <ReportMetric label="Total Sale" value={`Rs ${totalSales}`} />
          <ReportMetric label="Total Bills" value={String(Math.max(itemReports.length, 1))} />
          <ReportMetric label="Cash" value={`Rs ${cash}`} />
          <ReportMetric label="Online" value={`Rs ${upi}`} />
          <ReportMetric label="Expenses" value={`Rs ${totalExpenses}`} />
          {showProfit && <ReportMetric label={profit >= 0 ? "Profit" : "Loss"} value={`Rs ${Math.abs(profit)}`} />}
        </View>

        <ReportSection title="Today Report">
          <ReportRow label="Selected Date" value={activeRange[1]} detail={`${range} report`} />
          <ReportRow label="Bills / Quantity" value={String(totalQty)} detail="Total sold items" />
          <ReportRow label="Average Bill" value={`Rs ${avgBill}`} detail="Sale average" />
        </ReportSection>

        <ReportSection title="Date Wise Report">
          {dailyReports.map(row => <ReportRow key={row[0]} label={row[0]} value={row[1]} detail={row[2]} />)}
        </ReportSection>

        <ReportSection title="Item Wise Report">
          {itemReports.map(item => (
            <View key={item.id} style={styles.itemReportRow}>
              <View style={styles.itemReportName}>
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.listSub}>{item.quantity} qty - {item.category}</Text>
              </View>
              <View style={styles.itemReportMoney}>
                <Text style={styles.listAmount}>Rs {item.net}</Text>
                <Text style={styles.listSub}>Rate Rs {item.price}</Text>
              </View>
            </View>
          ))}
        </ReportSection>

        <ReportSection title="Payment Report">
          <ReportRow label="Cash" value={`Rs ${cash}`} detail="52%" />
          <ReportRow label="UPI / Online" value={`Rs ${upi}`} detail="38%" />
          <ReportRow label="Card" value={`Rs ${card}`} detail="10%" />
        </ReportSection>

        <ReportSection title="Expenses Report">
          {reportExpenses.map(row => <ReportRow key={row.id} label={row.category} value={`Rs ${row.amount}`} detail={`${row.date} - ${row.note}`} />)}
          <ReportRow label="Total Expenses" value={`Rs ${totalExpenses}`} detail="All expenses" />
        </ReportSection>

        <ReportSection title="Profit / Loss Report">
          <ReportRow label="Total Sales" value={`Rs ${totalSales}`} detail="Net sale after discount" />
          <ReportRow label="Food Cost" value={`Rs ${totalCost}`} detail="Estimated item cost" />
          <ReportRow label={profit >= 0 ? "Net Profit" : "Net Loss"} value={`Rs ${Math.abs(profit)}`} detail="Sales minus cost and expenses" />
        </ReportSection>

        <ReportSection title="Category Report">
          {categoryReports.map(row => <ReportRow key={row.label} label={row.label} value={`Rs ${row.amount}`} detail={`${row.qty} qty`} />)}
        </ReportSection>

        <ReportSection title="Cashier Report">
          <ReportRow label="Venkatesh" value={`Rs ${Math.round(totalSales * 0.58)}`} detail="Morning shift" />
          <ReportRow label="Cashier 2" value={`Rs ${Math.round(totalSales * 0.42)}`} detail="Evening shift" />
        </ReportSection>

        <ReportSection title="Hourly Sales">
          {hourlyReports.map(row => <ReportRow key={row[0]} label={row[0]} value={row[2]} detail={row[1]} />)}
        </ReportSection>

        <ReportSection title="Stock Report">
          <ReportRow label="Low Stock Items" value="2" detail="Need refill" />
          <ReportRow label="Discount Given" value={`Rs ${discount}`} detail="Selected bills" />
          <ReportRow label="Report Status" value="Ready" detail="Can share to WhatsApp" />
        </ReportSection>
      </View>
    </View>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reportMetric}>
      <Text style={styles.reportMetricValue}>{value}</Text>
      <Text style={styles.reportMetricLabel}>{label}</Text>
    </View>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.reportSection}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={styles.reportRows}>{children}</View>
    </View>
  );
}

function ReportRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.reportRow}>
      <View>
        <Text style={styles.listTitle}>{label}</Text>
        <Text style={styles.listSub}>{detail}</Text>
      </View>
      <Text style={styles.listAmount}>{value}</Text>
    </View>
  );
}

function TodaysSalesScreen() {
  return (
    <View style={styles.optionStack}>
      <View style={styles.statsRow}>
        <StatsCard tone="green" icon="▤" label="Total Sales" value="Rs 8,245" />
        <StatsCard tone="blue" icon="◷" label="Orders" value="112" />
      </View>
      <View style={styles.tableCard}>
        {["10131  Cash   Rs 8,245", "10122  UPI    Rs 235", "10144  Cash   Rs 530", "10127  UPI    Rs 520"].map(item => (
          <Text key={item} style={styles.tableLine}>{item}</Text>
        ))}
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Today's Sale Summary</Text>
        <InfoRow label="Cash" value="Rs 5,530" />
        <InfoRow label="Online" value="Rs 2,715" />
        <InfoRow label="Total" value="Rs 8,245" />
      </View>
    </View>
  );
}

function CashSummaryScreen() {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Settlement</Text>
      <InfoRow label="Opening Cash" value="Rs 1,000" />
      <InfoRow label="Cash Sales" value="Rs 5,530" />
      <InfoRow label="Refunds" value="Rs 0" />
      <InfoRow label="Expected Cash" value="Rs 6,530" />
      <TouchableOpacity style={styles.primaryAction}><Text style={styles.primaryActionText}>Print Summary</Text></TouchableOpacity>
    </View>
  );
}

function ExpensesScreen({
  expenses,
  onExpensesChange
}: {
  expenses: Expense[];
  onExpensesChange: (next: Expense[]) => void;
}) {
  const today = formatDateInput(new Date());
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("Raw Material");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const expenseCategories = ["Raw Material", "Staff", "Packing", "Maintenance", "Rent", "Utilities", "Delivery", "Other"];

  const addExpense = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onExpensesChange([
      { id: String(Date.now()), date, category, amount: value, note: note.trim() || category },
      ...expenses
    ]);
    setAmount("");
    setNote("");
  };

  return (
    <View style={styles.optionStack}>
      <View style={styles.formCard}>
        <Text style={styles.summaryTitle}>Add Expense</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <View style={styles.categoryPicker}>
          {expenseCategories.map(item => (
            <TouchableOpacity key={item} activeOpacity={0.85} onPress={() => setCategory(item)} style={[styles.smallChip, category === item && styles.smallChipActive]}>
              <Text style={[styles.smallChipText, category === item && styles.smallChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Amount" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <TextInput value={note} onChangeText={setNote} placeholder="Note" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={addExpense}>
          <Text style={styles.primaryActionText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <ReportSection title="Expenses List">
        {expenses.map(item => <ReportRow key={item.id} label={item.category} value={`Rs ${item.amount}`} detail={`${item.date} - ${item.note}`} />)}
      </ReportSection>
    </View>
  );
}

function StoreScreen({
  expenses,
  onExpensesChange,
  purchases,
  onPurchasesChange,
  usage,
  onUsageChange
}: {
  expenses: Expense[];
  onExpensesChange: (next: Expense[]) => void;
  purchases: StorePurchase[];
  onPurchasesChange: (next: StorePurchase[]) => void;
  usage: StoreUsage[];
  onUsageChange: (next: StoreUsage[]) => void;
}) {
  const today = formatDateInput(new Date());
  const [activeStoreTab, setActiveStoreTab] = useState<"Used" | "Purchase" | "List">("Purchase");
  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseDraftItem[]>([
    { id: "draft-1", item: "", category: "Raw Material", customCategory: "", quantity: "", unit: "Kgs", price: "" }
  ]);
  const [usedItem, setUsedItem] = useState("");
  const [usedQty, setUsedQty] = useState("");
  const [usedUnit, setUsedUnit] = useState<"Kgs" | "Pcs" | "Ltrs">("Kgs");
  const [usageError, setUsageError] = useState("");
  const storeCategories = ["Raw Material", "Vegetables", "Rice", "Oil", "Gas", "Packing", "Cleaning", "Other"];
  const units: ("Kgs" | "Pcs" | "Ltrs")[] = ["Kgs", "Pcs", "Ltrs"];
  const purchaseTotal = purchases.reduce((sum, row) => sum + Number(row.price || 0), 0);
  const usedCount = usage.filter(row => row.date === today).length;
  const inventory = purchases.reduce((map, row) => {
    const key = `${row.item} (${row.unit})`;
    const current = map.get(key) || { item: row.item, unit: row.unit, bought: 0, used: 0, amount: 0 };
    current.bought += Number(row.quantity || 0);
    current.amount += Number(row.price || 0);
    map.set(key, current);
    return map;
  }, new Map<string, { item: string; unit: string; bought: number; used: number; amount: number }>());
  usage.forEach(row => {
    const key = `${row.item} (${row.unit})`;
    const current = inventory.get(key) || { item: row.item, unit: row.unit, bought: 0, used: 0, amount: 0 };
    current.used += Number(row.quantity || 0);
    inventory.set(key, current);
  });

  const inventoryItems = Array.from(new Set([...inventory.values()].map(row => row.item)));
  const usageMatches = usedItem.trim()
    ? inventoryItems.filter(name => name.toLowerCase().includes(usedItem.trim().toLowerCase()))
    : inventoryItems.slice(0, 8);
  const selectedUsagePurchase = purchases.find(row => row.item.toLowerCase() === usedItem.trim().toLowerCase());
  const selectedUsageCategory = selectedUsagePurchase?.category || "";

  const updatePurchaseItem = (id: string, changes: Partial<PurchaseDraftItem>) => {
    setPurchaseItems(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row));
  };

  const addPurchaseItemRow = () => {
    setPurchaseItems(rows => [
      ...rows,
      { id: `draft-${Date.now()}`, item: "", category: "Raw Material", customCategory: "", quantity: "", unit: "Kgs", price: "" }
    ]);
  };

  const addPurchase = () => {
    const vendorName = vendor.trim();
    const validItems = purchaseItems
      .map(row => ({
        ...row,
        item: row.item.trim(),
        category: row.category === "Other" ? row.customCategory.trim() : row.category,
        quantityNumber: Number(row.quantity),
        priceNumber: Number(row.price)
      }))
      .filter(row => row.item && row.category && row.quantityNumber > 0 && row.priceNumber > 0);
    if (!vendorName || !validItems.length) return;
    const billId = String(Date.now());
    const nextPurchases: StorePurchase[] = validItems.map((row, index) => ({
      id: `${billId}-${index}`,
      date,
      vendor: vendorName,
      vendorAddress: vendorAddress.trim(),
      vendorPhone: vendorPhone.trim(),
      item: row.item,
      category: row.category,
      quantity: row.quantityNumber,
      unit: row.unit,
      price: row.priceNumber
    }));
    const amount = nextPurchases.reduce((sum, row) => sum + row.price, 0);
    onPurchasesChange([...nextPurchases, ...purchases]);
    onExpensesChange([
      { id: `store-${billId}`, date, category: "Store Purchase", amount, note: `${validItems.length} items from ${vendorName}` },
      ...expenses
    ]);
    setVendor("");
    setVendorAddress("");
    setVendorPhone("");
    setPurchaseItems([{ id: "draft-1", item: "", category: "Raw Material", customCategory: "", quantity: "", unit: "Kgs", price: "" }]);
  };

  const addUsage = () => {
    const qty = Number(usedQty);
    const name = usedItem.trim();
    const matchingPurchase = purchases.find(row => row.item.toLowerCase() === name.toLowerCase());
    if (!name || qty <= 0) return;
    if (!matchingPurchase) {
      setUsageError("Select an item from purchase list only");
      return;
    }
    onUsageChange([{ id: String(Date.now()), date: today, item: matchingPurchase.item, category: matchingPurchase.category, quantity: qty, unit: usedUnit }, ...usage]);
    setUsedItem("");
    setUsedQty("");
    setUsageError("");
  };

  return (
    <View style={styles.optionStack}>
      <View style={styles.storeHero}>
        <Text style={styles.adminHeroTitle}>Store</Text>
        <Text style={styles.adminHeroSub}>Purchases, daily usage, stock value and expenses auto calculation</Text>
      </View>

      <View style={styles.storeActionGrid}>
        {(["Used", "Purchase", "List"] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.86}
            onPress={() => setActiveStoreTab(tab)}
            style={[styles.storeActionCard, activeStoreTab === tab && styles.storeActionCardActive]}
          >
            <Text style={styles.storeActionIcon}>{tab === "Used" ? "U" : tab === "Purchase" ? "+" : "L"}</Text>
            <Text style={[styles.storeActionText, activeStoreTab === tab && styles.storeActionTextActive]}>
              {tab === "Used" ? "Today Used" : tab === "Purchase" ? "Purchase" : "List"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.reportGrid}>
        <ReportMetric label="Purchase Value" value={`Rs ${purchaseTotal}`} />
        <ReportMetric label="Purchase Bills" value={String(purchases.length)} />
        <ReportMetric label="Used Entries" value={String(usedCount)} />
        <ReportMetric label="Stock Items" value={String(inventory.size)} />
        <ReportMetric label="Expenses Added" value={`Rs ${purchaseTotal}`} />
        <ReportMetric label="Status" value="Ready" />
      </View>

      {activeStoreTab === "Purchase" && (
        <View style={styles.formCard}>
          <Text style={styles.summaryTitle}>Purchase Invoice</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#8a94a6" style={styles.realInput} />
          <TextInput value={vendor} onChangeText={setVendor} placeholder="Vendor name" placeholderTextColor="#8a94a6" style={styles.realInput} />
          <TextInput value={vendorAddress} onChangeText={setVendorAddress} placeholder="Vendor address" placeholderTextColor="#8a94a6" style={styles.realInput} />
          <TextInput value={vendorPhone} onChangeText={setVendorPhone} keyboardType="phone-pad" placeholder="Vendor phone number" placeholderTextColor="#8a94a6" style={styles.realInput} />

          {purchaseItems.map((row, index) => (
            <View key={row.id} style={styles.invoiceItemCard}>
              <Text style={styles.invoiceItemTitle}>Item {index + 1}</Text>
              <TextInput value={row.item} onChangeText={value => updatePurchaseItem(row.id, { item: value })} placeholder="Item name" placeholderTextColor="#8a94a6" style={styles.realInput} />
              <View style={styles.categoryPicker}>
                {storeCategories.map(categoryName => (
                  <TouchableOpacity key={categoryName} activeOpacity={0.85} onPress={() => updatePurchaseItem(row.id, { category: categoryName })} style={[styles.smallChip, row.category === categoryName && styles.smallChipActive]}>
                    <Text style={[styles.smallChipText, row.category === categoryName && styles.smallChipTextActive]}>{categoryName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {row.category === "Other" && (
                <TextInput value={row.customCategory} onChangeText={value => updatePurchaseItem(row.id, { customCategory: value })} placeholder="Enter category" placeholderTextColor="#8a94a6" style={styles.realInput} />
              )}
              <View style={styles.inputRow}>
                <TextInput value={row.quantity} onChangeText={value => updatePurchaseItem(row.id, { quantity: value })} keyboardType="numeric" placeholder="Qty" placeholderTextColor="#8a94a6" style={[styles.realInput, styles.inputFlex]} />
                <View style={styles.unitRow}>
                  {units.map(unitName => (
                    <TouchableOpacity key={unitName} activeOpacity={0.85} onPress={() => updatePurchaseItem(row.id, { unit: unitName })} style={[styles.unitChip, row.unit === unitName && styles.unitChipActive]}>
                      <Text style={[styles.unitChipText, row.unit === unitName && styles.unitChipTextActive]}>{unitName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput value={row.price} onChangeText={value => updatePurchaseItem(row.id, { price: value })} keyboardType="numeric" placeholder="Total price" placeholderTextColor="#8a94a6" style={styles.realInput} />
            </View>
          ))}
          <TouchableOpacity activeOpacity={0.86} style={styles.secondaryAction} onPress={addPurchaseItemRow}>
            <Text style={styles.secondaryActionText}>Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={addPurchase}>
            <Text style={styles.primaryActionText}>Create Purchase</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeStoreTab === "Used" && (
        <View style={styles.formCard}>
          <Text style={styles.summaryTitle}>Today Used Entry</Text>
          <TextInput value={usedItem} onChangeText={value => { setUsedItem(value); setUsageError(""); }} placeholder="Search purchased item" placeholderTextColor="#8a94a6" style={styles.realInput} />
          <View style={styles.suggestionList}>
            {usageMatches.map(name => (
              <TouchableOpacity key={name} activeOpacity={0.84} style={[styles.suggestionChip, usedItem === name && styles.suggestionChipActive]} onPress={() => {
                const match = purchases.find(row => row.item === name);
                setUsedItem(name);
                setUsedUnit(match?.unit || "Kgs");
                setUsageError("");
              }}>
                <Text style={[styles.suggestionChipText, usedItem === name && styles.suggestionChipTextActive]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!selectedUsageCategory && <Text style={styles.listSub}>Category: {selectedUsageCategory}</Text>}
          <View style={styles.inputRow}>
            <TextInput value={usedQty} onChangeText={setUsedQty} keyboardType="numeric" placeholder="Used qty" placeholderTextColor="#8a94a6" style={[styles.realInput, styles.inputFlex]} />
            <View style={styles.unitRow}>
              {units.map(row => (
                <TouchableOpacity key={row} activeOpacity={0.85} onPress={() => setUsedUnit(row)} style={[styles.unitChip, usedUnit === row && styles.unitChipActive]}>
                  <Text style={[styles.unitChipText, usedUnit === row && styles.unitChipTextActive]}>{row}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {!!usageError && <Text style={styles.errorText}>{usageError}</Text>}
          <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={addUsage}>
            <Text style={styles.primaryActionText}>Save Used Entry</Text>
          </TouchableOpacity>
        </View>
      )}

      <ReportSection title={activeStoreTab === "List" ? "Purchase List" : "Recent Store Activity"}>
        {purchases.length ? purchases.map(row => (
          <ReportRow
            key={row.id}
            label={`${row.item} - ${row.quantity} ${row.unit}`}
            value={`Rs ${row.price}`}
            detail={`${row.date} - ${row.vendor} - ${row.category}`}
          />
        )) : <ReportRow label="No purchases" value="Rs 0" detail="Create purchase to start store report" />}
      </ReportSection>

      <ReportSection title="Stock Balance">
        {[...inventory.values()].map(row => (
          <ReportRow
            key={`${row.item}-${row.unit}`}
            label={row.item}
            value={`${Math.max(0, row.bought - row.used)} ${row.unit}`}
            detail={`Bought ${row.bought} ${row.unit} - Used ${row.used} ${row.unit}`}
          />
        ))}
      </ReportSection>
    </View>
  );
}

function FinanceScreen({
  products,
  expenses,
  onExpensesChange,
  showProfit
}: {
  products: Product[];
  expenses: Expense[];
  onExpensesChange: (next: Expense[]) => void;
  showProfit: boolean;
}) {
  const today = formatDateInput(new Date());
  const [range, setRange] = useState<ReportRange>("Today");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const activeRange = buildRange(range, fromDate, toDate);
  const summary = useMemo(() => buildReportSummary(products, expenses, activeRange), [activeRange, expenses, products]);

  const applyRange = (nextRange: ReportRange) => {
    const [nextFrom, nextTo] = buildRange(nextRange, fromDate, toDate);
    setRange(nextRange);
    setFromDate(nextFrom);
    setToDate(nextTo);
  };

  return (
    <View style={styles.optionStack}>
      <View style={styles.reportFilterCard}>
        <View style={styles.dateRow}>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>From Date</Text>
            <TextInput value={fromDate} onChangeText={value => { setRange("Custom"); setFromDate(value); }} style={styles.dateInput} />
          </View>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>To Date</Text>
            <TextInput value={toDate} onChangeText={value => { setRange("Custom"); setToDate(value); }} style={styles.dateInput} />
          </View>
        </View>
        <View style={styles.quickRangeRow}>
          {(["Today", "Week", "Month", "Year", "Custom"] as ReportRange[]).map(item => (
            <TouchableOpacity key={item} activeOpacity={0.85} onPress={() => applyRange(item)} style={[styles.quickRangeChip, range === item && styles.quickRangeChipActive]}>
              <Text style={[styles.quickRangeText, range === item && styles.quickRangeTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.financeBoxGrid}>
        <ReportMetric label="Sales" value={`Rs ${summary.totalSales}`} />
        <ReportMetric label="Food Cost" value={`Rs ${summary.totalCost}`} />
        <ReportMetric label="Expenses" value={`Rs ${summary.totalExpenses}`} />
        {showProfit && <ReportMetric label={summary.profit >= 0 ? "Profit" : "Loss"} value={`Rs ${Math.abs(summary.profit)}`} />}
      </View>

      <ExpensesScreen expenses={expenses} onExpensesChange={onExpensesChange} />
    </View>
  );
}

function CategoryManagerScreen({
  categories,
  onCategoriesChange
}: {
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
}) {
  const [name, setName] = useState("");
  const addCategory = () => {
    const value = name.trim();
    if (!value || categories.includes(value)) return;
    onCategoriesChange([...categories, value]);
    setName("");
  };

  return (
    <View style={styles.optionStack}>
      <View style={styles.formCard}>
        <Text style={styles.summaryTitle}>Add Category</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Category name" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={addCategory}>
          <Text style={styles.primaryActionText}>Add Category</Text>
        </TouchableOpacity>
      </View>
      <ReportSection title="Restaurant Categories">
        {categories.map(item => <ReportRow key={item} label={item} value="Active" detail="Available in billing and items" />)}
      </ReportSection>
    </View>
  );
}

function ItemManagerScreen({
  products,
  onProductsChange,
  categories,
  onCategoriesChange
}: {
  products: Product[];
  onProductsChange: (next: Product[]) => void;
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
}) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>(categories[0] || "Meals");
  const [newPrice, setNewPrice] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newSubItem, setNewSubItem] = useState("");
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const unlock = () => {
    if (password.trim() === "1234" || password.trim().toLowerCase() === "admin123") {
      setUnlocked(true);
      setError("");
      return;
    }
    setError("Invalid admin password");
  };

  const updateProduct = (id: string, changes: Partial<Product>) => {
    onProductsChange(products.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const addSubItem = (id: string) => {
    const value = (subInputs[id] || "").trim();
    if (!value) return;
    onProductsChange(products.map(item => (
      item.id === id ? { ...item, subItems: [...(item.subItems ?? []), value] } : item
    )));
    setSubInputs(inputs => ({ ...inputs, [id]: "" }));
  };

  const addNewProduct = () => {
    const name = newName.trim();
    const price = Number(newPrice);
    if (!name || !Number.isFinite(price) || price <= 0) {
      setError("Enter item name and valid price");
      return;
    }
    const nextProduct: Product = {
      id: String(Date.now()),
      name,
      price,
      category: newCategory,
      subItems: newSubItem.trim() ? [newSubItem.trim()] : undefined,
      image: newImage.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80"
    };
    onProductsChange([...products, nextProduct]);
    if (!categories.includes(newCategory)) onCategoriesChange([...categories, newCategory]);
    setNewName("");
    setNewPrice("");
    setNewImage("");
    setNewSubItem("");
    setError("");
  };

  if (!unlocked) {
    return (
      <View style={styles.formCard}>
        <Text style={styles.summaryTitle}>Admin Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Enter admin password"
          placeholderTextColor="#8a94a6"
          style={styles.realInput}
        />
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={unlock}>
          <Text style={styles.primaryActionText}>Unlock Items</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.optionStack}>
      <View style={styles.formCard}>
        <Text style={styles.summaryTitle}>Add Item</Text>
        <TextInput value={newName} onChangeText={setNewName} placeholder="Item name" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <View style={styles.categoryPicker}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              activeOpacity={0.85}
              onPress={() => setNewCategory(category)}
              style={[styles.smallChip, newCategory === category && styles.smallChipActive]}
            >
              <Text style={[styles.smallChipText, newCategory === category && styles.smallChipTextActive]}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" placeholder="Price" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <TextInput value={newImage} onChangeText={setNewImage} placeholder="Image URL optional" placeholderTextColor="#8a94a6" style={styles.realInput} />
        <TextInput value={newSubItem} onChangeText={setNewSubItem} placeholder="Sub item optional" placeholderTextColor="#8a94a6" style={styles.realInput} />
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity activeOpacity={0.9} style={styles.primaryAction} onPress={addNewProduct}>
          <Text style={styles.primaryActionText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.managerHeader}>
        <Text style={styles.summaryTitle}>Existing Items</Text>
        <Text style={styles.managerCount}>{products.length} items</Text>
      </View>

      {products.map(item => (
        <View key={item.id} style={styles.itemManageCard}>
          <View style={styles.itemManageTop}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={[styles.manageImage, item.hidden && styles.hiddenImage]} />
            ) : (
              <View style={[styles.manageImage, styles.imageFallback]}>
                <Text style={styles.imageFallbackText}>{item.name.slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.manageInfo}>
              <Text style={styles.listTitle}>{item.name}</Text>
              <Text style={styles.listSub}>{item.category} - {item.hidden ? "Hidden" : "Visible"}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.86} style={styles.miniActionButton} onPress={() => setEditingId(editingId === item.id ? null : item.id)}>
              <Text style={styles.miniActionText}>{editingId === item.id ? "Done" : "Edit"}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={[styles.miniActionButton, item.hidden && styles.showActionButton]} onPress={() => updateProduct(item.id, { hidden: !item.hidden })}>
              <Text style={styles.miniActionText}>{item.hidden ? "Show" : "Hide"}</Text>
            </TouchableOpacity>
          </View>

          {editingId === item.id ? (
            <>
              <View style={styles.editGrid}>
                <TextInput
                  value={item.name}
                  onChangeText={value => updateProduct(item.id, { name: value })}
                  placeholder="Item name"
                  placeholderTextColor="#8a94a6"
                  style={styles.realInput}
                />
                <TextInput
                  value={String(item.price)}
                  onChangeText={value => updateProduct(item.id, { price: Number(value) || 0 })}
                  keyboardType="numeric"
                  placeholder="Price"
                  placeholderTextColor="#8a94a6"
                  style={styles.realInput}
                />
                <TextInput
                  value={item.image}
                  onChangeText={value => updateProduct(item.id, { image: value })}
                  placeholder="Image URL"
                  placeholderTextColor="#8a94a6"
                  style={styles.realInput}
                />
              </View>
              <View style={styles.categoryPicker}>
                {categories.map(category => (
                  <TouchableOpacity
                    key={category}
                    activeOpacity={0.85}
                    onPress={() => updateProduct(item.id, { category })}
                    style={[styles.smallChip, item.category === category && styles.smallChipActive]}
                  >
                    <Text style={[styles.smallChipText, item.category === category && styles.smallChipTextActive]}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.addSubRow}>
                <TextInput
                  value={subInputs[item.id] || ""}
                  onChangeText={value => setSubInputs(inputs => ({ ...inputs, [item.id]: value }))}
                  placeholder="Add sub item"
                  placeholderTextColor="#8a94a6"
                  style={styles.subInput}
                />
                <TouchableOpacity activeOpacity={0.86} style={styles.addSubButton} onPress={() => addSubItem(item.id)}>
                  <Text style={styles.addSubButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.subItemsWrap}>
              {(item.subItems && item.subItems.length > 0) ? item.subItems.map(subItem => (
                <View key={subItem} style={styles.subPill}>
                  <Text style={styles.subPillText}>{subItem}</Text>
                </View>
              )) : (
                <Text style={styles.listSub}>No sub items</Text>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function StockAvailabilityScreen({ products }: { products: Product[] }) {
  return (
    <View style={styles.optionStack}>
      <SearchBar />
      {products.map((item, index) => (
        <View key={item.id} style={styles.inventoryRow}>
          <Image source={{ uri: item.image }} style={styles.inventoryImage} />
          <View style={styles.inventoryText}>
            <Text style={styles.listTitle}>{item.name}</Text>
            <Text style={styles.listSub}>Rs {item.price}</Text>
          </View>
          <Text style={[styles.stockText, index % 3 === 0 && styles.lowStockText]}>{index % 3 === 0 ? "Low Stock" : "In Stock"}</Text>
        </View>
      ))}
    </View>
  );
}

function PrinterSettingsScreen() {
  return (
    <View style={styles.optionStack}>
      {[1, 2, 3, 4].map(item => (
        <View key={item} style={styles.listCard}>
          <View style={styles.drawerItemIcon}><Text style={styles.drawerItemIconText}>P</Text></View>
          <View style={styles.profileTextBlock}>
            <Text style={styles.listTitle}>Thermal Receipt Printer {item}</Text>
            <Text style={styles.connected}>Connected</Text>
          </View>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ))}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Settings</Text>
        <InfoRow label="Paper Width" value="58mm" />
        <InfoRow label="Default Printer" value="ON" />
        <TouchableOpacity style={styles.primaryAction}><Text style={styles.primaryActionText}>Test Print</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function UserScreen() {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>User</Text>
      <InfoRow label="Cashier" value="Venkatesh" />
      <InfoRow label="Role" value="Cashier" />
      <InfoRow label="Login Time" value="09:00 AM" />
      <TouchableOpacity style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Switch User</Text></TouchableOpacity>
    </View>
  );
}

function SettingsScreen({
  settings,
  onSettingsChange
}: {
  settings: SuperAdminSettings;
  onSettingsChange: (next: SuperAdminSettings) => void;
}) {
  const toggle = (key: keyof SuperAdminSettings) => {
    onSettingsChange({ ...settings, [key]: !settings[key] });
  };

  return (
    <View style={styles.optionStack}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Operational Settings</Text>
        <InfoRow label="Outlet" value="Main Canteen" />
        <InfoRow label="Currency" value="Rs" />
        <InfoRow label="Tax" value="0%" />
        <InfoRow label="Compact Mode" value="ON" />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Super Admin Marketing</Text>
        <TouchableOpacity activeOpacity={0.86} style={styles.settingToggleRow} onPress={() => toggle("showProfitToCanteen")}>
          <View>
            <Text style={styles.listTitle}>Show Profit To Canteen</Text>
            <Text style={styles.listSub}>Tick on shows profit, tick off hides profit</Text>
          </View>
          <Text style={[styles.tickBox, settings.showProfitToCanteen && styles.tickBoxActive]}>
            {settings.showProfitToCanteen ? "OK" : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.86} style={styles.settingToggleRow} onPress={() => toggle("openAdminDashboardFirst")}>
          <View>
            <Text style={styles.listTitle}>Admin Dashboard First</Text>
            <Text style={styles.listSub}>Tick on opens Dashboard, tick off opens Sale Home</Text>
          </View>
          <Text style={[styles.tickBox, settings.openAdminDashboardFirst && styles.tickBoxActive]}>
            {settings.openAdminDashboardFirst ? "OK" : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryAction}><Text style={styles.primaryActionText}>Save Changes</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function SyncDataScreen() {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>All data synced</Text>
      <InfoRow label="Last Sync" value="Just now" />
      <InfoRow label="Pending Bills" value="0" />
      <InfoRow label="Pending Items" value="0" />
      <InfoRow label="Network" value="Connected" />
      <TouchableOpacity style={styles.primaryAction}><Text style={styles.primaryActionText}>Sync Now</Text></TouchableOpacity>
    </View>
  );
}

function LogoutScreen() {
  return (
    <View style={styles.logoutPanel}>
      <Text style={styles.logoutTitle}>Logout from this user?</Text>
      <Text style={styles.listSub}>Cashier Venkatesh</Text>
      <Text style={styles.warningText}>All data is synced. You can safely logout.</Text>
      <TouchableOpacity style={styles.logoutConfirm}><Text style={styles.logoutConfirmText}>Logout</Text></TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatsCard({ tone, icon, label, value }: { tone: "green" | "blue"; icon: string; label: string; value: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.statsCard, tone === "green" ? styles.statsGreen : styles.statsBlue]}
    >
      <Text style={[styles.statsIcon, tone === "green" ? styles.textGreen : styles.textBlue]}>{icon}</Text>
      <View>
        <Text style={[styles.statsLabel, tone === "green" ? styles.textGreen : styles.textBlue]}>{label}</Text>
        <Text style={styles.statsValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

const CategoryTabs = memo(function CategoryTabs({
  categories,
  active,
  onChange
}: {
  categories: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.tabs}>
      {categories.map(category => (
        <TouchableOpacity
          key={category}
          activeOpacity={0.85}
          onPress={() => onChange(category)}
          style={[styles.tab, active === category && styles.activeTab]}
        >
          <Text style={[styles.tabText, active === category && styles.activeTabText]}>{category}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

const ProductCard = memo(function ProductCard({
  product,
  width,
  onPress,
  onLongPress
}: {
  product: Product;
  width: number;
  onPress: (product: Product) => void;
  onLongPress: (product: Product) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      delayLongPress={260}
      onPress={() => onPress(product)}
      onLongPress={() => onLongPress(product)}
      style={[styles.productCard, { width }]}
    >
      <Image source={{ uri: product.image }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
        <Text style={styles.productPrice}>Rs {product.price}</Text>
      </View>
    </TouchableOpacity>
  );
});

function SubItemsSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const subItems = product.subItems ?? [];

  return (
    <View style={styles.subSheetLayer} pointerEvents="box-none">
      <Pressable style={styles.subSheetOverlay} onPress={onClose} />
      <View style={styles.subSheet}>
        <View style={styles.subSheetHeader}>
          <View>
            <Text style={styles.subSheetTitle}>{product.name}</Text>
            <Text style={styles.subSheetSub}>Sub items</Text>
          </View>
          <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.subSheetClose}>
            <Text style={styles.subSheetCloseText}>x</Text>
          </TouchableOpacity>
        </View>

        {subItems.length > 0 ? (
          <View style={styles.subItemList}>
            {subItems.map(item => (
              <View key={item} style={styles.subItemRow}>
                <Text style={styles.subItemText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySubItems}>
            <Text style={styles.emptySubItemsText}>Empty</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CartPanel({ count, total, onClear }: { count: number; total: number; onClear: () => void }) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Online");

  return (
    <View style={styles.cartPanel}>
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Cart ({count} items)</Text>
        <TouchableOpacity onPress={onClear} activeOpacity={0.8}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>Rs {total}</Text>
      </View>

      <View style={styles.paymentModeHeader}>
        <Text style={styles.paymentModeTitle}>Payment Mode</Text>
        <Text style={styles.paymentModeSelected}>{paymentMode}</Text>
      </View>

      <View style={styles.paymentModeGrid}>
        {paymentModeOptions.map(mode => {
          const selected = paymentMode === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              activeOpacity={0.88}
              onPress={() => setPaymentMode(mode.id)}
              style={[
                styles.paymentModeCard,
                { backgroundColor: selected ? mode.bg : "#fbfcff", borderColor: selected ? mode.color : LINE },
                selected && styles.paymentModeCardActive
              ]}
            >
              <PaymentModeIcon mode={mode.id} color={mode.color} />
              <Text style={[styles.paymentModeCardTitle, selected && { color: mode.color }]} numberOfLines={1}>
                {mode.title}
              </Text>
              <Text style={styles.paymentModeCardSub} numberOfLines={2}>
                {mode.subtitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity activeOpacity={0.9} style={styles.payButton}>
        <Text style={styles.payText}>{paymentMode} Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

function PaymentModeIcon({ mode, color }: { mode: PaymentMode; color: string }) {
  if (mode === "Online") {
    return (
      <View style={[styles.paymentLogo, { backgroundColor: "#eef6ff", borderColor: "#bfdbfe" }]}>
        <Text style={styles.gpayG}>G</Text>
        <Text style={[styles.logoPayText, { color }]}>Pay</Text>
      </View>
    );
  }

  if (mode === "Cash") {
    return (
      <View style={[styles.paymentLogo, { backgroundColor: "#ecfdf3", borderColor: "#bbf7d0" }]}>
        <View style={[styles.cashNote, { borderColor: color }]}>
          <Text style={[styles.cashText, { color }]}>Rs</Text>
        </View>
        <Text style={[styles.logoPayText, { color }]}>Cash</Text>
      </View>
    );
  }

  if (mode === "Split") {
    return (
      <View style={[styles.paymentLogo, { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" }]}>
        <View style={styles.splitIconRow}>
          <View style={[styles.splitCircle, { backgroundColor: "#16a34a" }]}>
            <Text style={styles.splitCircleText}>C</Text>
          </View>
          <View style={[styles.splitCircle, styles.splitCircleOverlap, { backgroundColor: color }]}>
            <Text style={styles.splitCircleText}>U</Text>
          </View>
        </View>
        <Text style={[styles.logoPayText, { color }]}>Split</Text>
      </View>
    );
  }

  return (
    <View style={[styles.paymentLogo, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
      <View style={[styles.creditCardIcon, { borderColor: color }]}>
        <View style={[styles.creditCardLine, { backgroundColor: color }]} />
        <Text style={[styles.creditText, { color }]}>CR</Text>
      </View>
      <Text style={[styles.logoPayText, { color }]}>Credit</Text>
    </View>
  );
}

function BottomNav({ activeOption, onSelect }: { activeOption: DrawerOption; onSelect: (item: BottomNavItem) => void }) {
  const items: BottomNavItem[] = ["Home", "Orders", "Reports", "Settings"];
  const labels: Record<BottomNavItem, string> = {
    Home: "Billing",
    Orders: "Orders",
    Reports: "Reports",
    Settings: "Settings"
  };
  const activeItem: Record<BottomNavItem, boolean> = {
    Home: activeOption === "Dashboard" || activeOption === "New Billing",
    Orders: activeOption === "Orders",
    Reports: activeOption === "Reports",
    Settings: activeOption === "Settings"
  };

  return (
    <View style={styles.bottomNav}>
      {items.map(item => {
        const active = activeItem[item];
        return (
          <TouchableOpacity
            key={item}
            activeOpacity={0.85}
            onPress={() => onSelect(item)}
            style={[styles.navItem, active && styles.navActive]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.navText, active && styles.navActiveText]}>
              {labels[item]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: CARD
  },
  page: {
    flex: 1,
    backgroundColor: CARD
  },
  header: {
    minHeight: 116,
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 28,
    backgroundColor: "#fdfefe",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f1f4f8",
    shadowColor: "#101828",
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  decorCutlery: {
    position: "absolute",
    right: -4,
    bottom: -34,
    color: NAVY,
    fontSize: 116,
    opacity: 0.06,
    transform: [{ rotate: "-12deg" }]
  },
  menuButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  menuBars: {
    width: 27,
    gap: 6
  },
  menuBar: {
    height: 4,
    borderRadius: 4,
    backgroundColor: NAVY
  },
  menuIcon: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900"
  },
  logo: {
    width: 66,
    height: 66,
    marginLeft: 14,
    borderRadius: 33,
    backgroundColor: CARD,
    borderWidth: 7,
    borderColor: "#f6f8fb",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 33
  },
  logoIcon: {
    color: "#24324a",
    fontSize: 28,
    fontWeight: "900"
  },
  headerTitle: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center"
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 6
  },
  title: {
    color: "#071a3d",
    fontSize: 22,
    fontWeight: "900"
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 28,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#ecfdf3",
    borderWidth: 1,
    borderColor: "#bbf7d0"
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16a34a"
  },
  connected: {
    color: "#16a34a",
    fontSize: 14,
    fontWeight: "900"
  },
  content: {
    paddingTop: 16
  },
  optionContent: {
    paddingTop: 18
  },
  optionTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14
  },
  optionStack: {
    gap: 12
  },
  adminHero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: "#163a73"
  },
  adminHeroTitle: {
    color: CARD,
    fontSize: 20,
    fontWeight: "900"
  },
  adminHeroSub: {
    marginTop: 6,
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  searchBar: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1
  },
  searchIcon: {
    color: MUTED,
    fontSize: 20,
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    fontWeight: "700"
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14
  },
  statsCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#edf1f5"
  },
  statsGreen: {
    backgroundColor: "#edf9ef"
  },
  statsBlue: {
    backgroundColor: "#eef5ff"
  },
  statsIcon: {
    fontSize: 24,
    marginRight: 12,
    fontWeight: "900"
  },
  statsLabel: {
    fontSize: 14,
    fontWeight: "900"
  },
  statsValue: {
    marginTop: 4,
    color: "#111827",
    fontSize: 22,
    fontWeight: "900"
  },
  textGreen: {
    color: "#168a2f"
  },
  textBlue: {
    color: "#165dcc"
  },
  reportFilterCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  reportHeaderCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b"
  },
  dateRow: {
    flexDirection: "row",
    gap: 10
  },
  dateInputWrap: {
    flex: 1
  },
  dateLabel: {
    marginBottom: 6,
    color: MUTED,
    fontSize: 12,
    fontWeight: "900"
  },
  dateInput: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 12
  },
  quickRangeRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickRangeChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#edf4ff",
    borderWidth: 1,
    borderColor: "#d7e4f6",
    justifyContent: "center"
  },
  quickRangeChipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY
  },
  quickRangeText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "900"
  },
  quickRangeTextActive: {
    color: CARD
  },
  reportActionRow: {
    marginTop: 13,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  reportActionButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  reportActionText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900"
  },
  whatsappButton: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a"
  },
  whatsappButtonText: {
    color: CARD
  },
  shareStatus: {
    marginTop: 9,
    color: MUTED,
    fontSize: 12,
    fontWeight: "800"
  },
  reportCaptureArea: {
    gap: 12,
    backgroundColor: PAGE
  },
  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  financeBoxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  reportMetric: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 76,
    borderRadius: 14,
    padding: 11,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    justifyContent: "center"
  },
  reportMetricValue: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "900"
  },
  reportMetricLabel: {
    marginTop: 5,
    color: MUTED,
    fontSize: 10,
    fontWeight: "900"
  },
  reportSection: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  reportRows: {
    gap: 9
  },
  reportRow: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  itemReportRow: {
    minHeight: 62,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  itemReportName: {
    flex: 1,
    paddingRight: 10
  },
  itemReportMoney: {
    alignItems: "flex-end"
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: 14
  },
  tab: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  activeTab: {
    backgroundColor: "#edf4ff",
    borderColor: "#c8d8ef"
  },
  tabText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  activeTabText: {
    color: NAVY
  },
  productCard: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: "#e8edf4",
    overflow: "hidden",
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2
  },
  productImage: {
    width: "100%",
    aspectRatio: 1.15,
    backgroundColor: "#eef2f7"
  },
  productInfo: {
    padding: 10
  },
  productName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  productPrice: {
    marginTop: 5,
    color: NAVY,
    fontSize: 15,
    fontWeight: "900"
  },
  subSheetLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 30
  },
  subSheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(2,6,23,0.34)"
  },
  subSheet: {
    marginHorizontal: 16,
    marginBottom: 156,
    borderRadius: 20,
    padding: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12
  },
  subSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  subSheetTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900"
  },
  subSheetSub: {
    marginTop: 3,
    color: MUTED,
    fontSize: 12,
    fontWeight: "800"
  },
  subSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f2f6fb",
    alignItems: "center",
    justifyContent: "center"
  },
  subSheetCloseText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  subItemList: {
    marginTop: 14,
    gap: 8
  },
  subItemRow: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    justifyContent: "center"
  },
  subItemText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800"
  },
  emptySubItems: {
    minHeight: 66,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  emptySubItemsText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "900"
  },
  listCard: {
    minHeight: 72,
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  listTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  listSub: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: "700"
  },
  rightInfo: {
    alignItems: "flex-end"
  },
  listAmount: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  badgeText: {
    marginTop: 5,
    color: "#168a2f",
    fontSize: 12,
    fontWeight: "900"
  },
  tableCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE
  },
  tableLine: {
    minHeight: 34,
    color: "#111827",
    fontSize: 13,
    fontWeight: "800"
  },
  summaryCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  summaryTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12
  },
  infoRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7"
  },
  infoLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "800"
  },
  infoValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900"
  },
  primaryAction: {
    minHeight: 52,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionText: {
    color: CARD,
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryAction: {
    minHeight: 50,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#edf4ff",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryActionText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "900"
  },
  formCard: {
    gap: 10,
    borderRadius: 20,
    padding: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE
  },
  fakeInput: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  fakeInputText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "800"
  },
  realInput: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 14
  },
  bulkInput: {
    minHeight: 118,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  errorText: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "800"
  },
  categoryPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  storeHero: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  storeActionGrid: {
    flexDirection: "row",
    gap: 10
  },
  storeActionCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  storeActionCardActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
    shadowColor: NAVY,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  storeActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#edf4ff",
    color: NAVY,
    textAlign: "center",
    lineHeight: 32,
    fontSize: 14,
    fontWeight: "900",
    overflow: "hidden"
  },
  storeActionText: {
    marginTop: 7,
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  storeActionTextActive: {
    color: CARD
  },
  invoiceItemCard: {
    gap: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eef2f7"
  },
  invoiceItemTitle: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inputFlex: {
    flex: 1
  },
  unitRow: {
    flexDirection: "row",
    gap: 6
  },
  unitChip: {
    minWidth: 42,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  unitChipActive: {
    backgroundColor: "#ecfdf3",
    borderColor: "#86efac"
  },
  unitChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900"
  },
  unitChipTextActive: {
    color: "#15803d"
  },
  smallChip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  smallChipActive: {
    backgroundColor: "#edf4ff",
    borderColor: "#c8d8ef"
  },
  smallChipText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900"
  },
  smallChipTextActive: {
    color: NAVY
  },
  suggestionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  suggestionChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    justifyContent: "center"
  },
  suggestionChipActive: {
    backgroundColor: "#edf4ff",
    borderColor: "#c8d8ef"
  },
  suggestionChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900"
  },
  suggestionChipTextActive: {
    color: NAVY
  },
  settingToggleRow: {
    minHeight: 66,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  tickBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#f8fafc",
    color: CARD,
    textAlign: "center",
    lineHeight: 38,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden"
  },
  tickBoxActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
    color: CARD
  },
  managerHeader: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  managerCount: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "900"
  },
  itemManageCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  itemManageTop: {
    flexDirection: "row",
    alignItems: "center"
  },
  manageImage: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: "#eef2f7"
  },
  hiddenImage: {
    opacity: 0.38
  },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center"
  },
  imageFallbackText: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "900"
  },
  manageInfo: {
    flex: 1,
    marginLeft: 11
  },
  miniActionButton: {
    minWidth: 48,
    minHeight: 36,
    marginLeft: 6,
    borderRadius: 12,
    backgroundColor: "#edf4ff",
    borderWidth: 1,
    borderColor: "#d7e4f6",
    alignItems: "center",
    justifyContent: "center"
  },
  showActionButton: {
    backgroundColor: "#ecfdf3",
    borderColor: "#bbf7d0"
  },
  miniActionText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "900"
  },
  editGrid: {
    marginTop: 12,
    gap: 8
  },
  editPriceBox: {
    width: 92
  },
  editPriceLabel: {
    marginBottom: 5,
    color: MUTED,
    fontSize: 11,
    fontWeight: "900"
  },
  priceInput: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    color: NAVY,
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: 10
  },
  subItemsWrap: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  subPill: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#edf4ff",
    borderWidth: 1,
    borderColor: "#d7e4f6",
    justifyContent: "center"
  },
  subPillText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "900"
  },
  addSubRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  subInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12
  },
  addSubButton: {
    minWidth: 62,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center"
  },
  addSubButtonText: {
    color: CARD,
    fontSize: 13,
    fontWeight: "900"
  },
  priceBox: {
    minWidth: 78,
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LINE
  },
  priceBoxText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "900"
  },
  inventoryRow: {
    minHeight: 78,
    borderRadius: 18,
    padding: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    flexDirection: "row",
    alignItems: "center"
  },
  inventoryImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#eef2f7"
  },
  inventoryText: {
    flex: 1,
    marginLeft: 12
  },
  stockText: {
    color: "#168a2f",
    fontSize: 13,
    fontWeight: "900"
  },
  lowStockText: {
    color: "#b42318"
  },
  checkText: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#dcfce7",
    color: "#168a2f",
    textAlign: "center",
    lineHeight: 28,
    fontSize: 16,
    fontWeight: "900"
  },
  logoutPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#fff7f7",
    borderWidth: 1,
    borderColor: "#ffd5dc"
  },
  logoutTitle: {
    color: "#991b1b",
    fontSize: 19,
    fontWeight: "900"
  },
  warningText: {
    marginTop: 16,
    color: MUTED,
    fontSize: 13,
    fontWeight: "800"
  },
  logoutConfirm: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: "#e11d48",
    alignItems: "center",
    justifyContent: "center"
  },
  logoutConfirmText: {
    color: CARD,
    fontSize: 15,
    fontWeight: "900"
  },
  cartPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 94,
    padding: 16,
    borderRadius: 22,
    backgroundColor: CARD,
    shadowColor: "#101828",
    shadowOpacity: 0.15,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10
  },
  cartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cartTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900"
  },
  clearText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "900"
  },
  totalRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  totalLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  totalValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900"
  },
  paymentModeHeader: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  paymentModeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900"
  },
  paymentModeSelected: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: "#eef2f7",
    color: NAVY,
    fontSize: 12,
    lineHeight: 26,
    fontWeight: "900",
    overflow: "hidden"
  },
  paymentModeGrid: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  paymentModeCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  paymentModeCardActive: {
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3
  },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  paymentLogo: {
    width: 58,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  gpayG: {
    color: "#4285f4",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900"
  },
  logoPayText: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: "900"
  },
  upiText: {
    fontSize: 12,
    fontWeight: "900"
  },
  upiRail: {
    marginTop: 3,
    flexDirection: "row",
    gap: 2
  },
  upiMark: {
    width: 10,
    height: 5,
    borderRadius: 3
  },
  cashNote: {
    width: 30,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD
  },
  cashText: {
    fontSize: 11,
    fontWeight: "900"
  },
  splitIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  splitCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CARD
  },
  splitCircleOverlap: {
    marginLeft: -8
  },
  splitCircleText: {
    color: CARD,
    fontSize: 10,
    fontWeight: "900"
  },
  creditCardIcon: {
    width: 31,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: CARD,
    overflow: "hidden"
  },
  creditCardLine: {
    height: 5,
    marginTop: 4
  },
  creditText: {
    marginTop: 1,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "900"
  },
  paymentModeCardTitle: {
    marginTop: 7,
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  paymentModeCardSub: {
    marginTop: 2,
    color: MUTED,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  payButton: {
    minHeight: 54,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center"
  },
  payText: {
    color: CARD,
    fontSize: 16,
    fontWeight: "900"
  },
  bottomNav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 64,
    borderRadius: 18,
    backgroundColor: NAVY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  navItem: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    paddingHorizontal: 2,
    overflow: "hidden"
  },
  navActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)"
  },
  navText: {
    color: CARD,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false
  },
  navActiveText: {
    color: CARD
  },
  drawerLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 40
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#020617"
  },
  overlayPressable: {
    flex: 1
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderTopRightRadius: 34,
    borderBottomRightRadius: 34,
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#020617",
    shadowOpacity: 0.24,
    shadowRadius: 30,
    shadowOffset: { width: 14, height: 0 },
    elevation: 18
  },
  drawerScroll: {
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 136
  },
  drawerTop: {
    minHeight: 112,
    borderRadius: 26,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  drawerLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center"
  },
  drawerLogoIcon: {
    color: CARD,
    fontSize: 26,
    fontWeight: "900"
  },
  drawerTitleBlock: {
    flex: 1,
    marginLeft: 13
  },
  drawerTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900"
  },
  drawerMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  drawerBadge: {
    minHeight: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: "#eef0f5",
    alignItems: "center",
    justifyContent: "center"
  },
  drawerBadgeText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "900"
  },
  drawerStatus: {
    flexDirection: "row",
    alignItems: "center"
  },
  profileCard: {
    marginTop: 16,
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  cashierIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#edf4ff",
    alignItems: "center",
    justifyContent: "center"
  },
  cashierIconText: {
    color: NAVY,
    fontSize: 19,
    fontWeight: "900"
  },
  profileTextBlock: {
    flex: 1,
    marginLeft: 12
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 9,
    rowGap: 7
  },
  profileName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  onlineBadge: {
    alignSelf: "flex-start",
    minHeight: 25,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: "#ecfdf3",
    flexDirection: "row",
    alignItems: "center"
  },
  onlineBadgeText: {
    color: "#168a2f",
    fontSize: 12,
    fontWeight: "900"
  },
  drawerSection: {
    marginTop: 18
  },
  sectionTitle: {
    marginLeft: 6,
    marginBottom: 8,
    color: "#8a94a6",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  sectionCard: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  drawerItem: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center"
  },
  drawerItemSelected: {
    backgroundColor: "#edf4ff"
  },
  drawerItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.72)"
  },
  drawerItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginRight: 11,
    backgroundColor: "#f2f6fb",
    alignItems: "center",
    justifyContent: "center"
  },
  drawerItemIconSelected: {
    backgroundColor: NAVY
  },
  drawerItemIconText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  drawerItemIconTextSelected: {
    color: CARD
  },
  drawerItemText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800"
  },
  drawerItemTextSelected: {
    color: NAVY,
    fontWeight: "900"
  },
  drawerBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 20,
    paddingTop: 14,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#fff1f3",
    borderWidth: 1,
    borderColor: "#ffd5dc",
    alignItems: "center",
    justifyContent: "center"
  },
  logoutText: {
    color: "#e11d48",
    fontSize: 16,
    fontWeight: "900"
  },
  versionText: {
    marginTop: 10,
    color: "#98a2b3",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800"
  }
});
