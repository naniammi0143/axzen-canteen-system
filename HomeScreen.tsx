import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";

const NAVY = "#082653";
const PAGE = "#f5f7fb";
const CARD = "#ffffff";
const LINE = "#e5eaf0";
const MUTED = "#667085";
const GREEN = "#22c55e";

const itemCategories = ["Meals", "Tiffins", "Tea"] as const;
const categories = ["All", ...itemCategories] as const;
const registeredCanteen = {
  name: "Main Canteen",
  logoUri: ""
};

type Category = (typeof categories)[number];
type BottomNavItem = "Home" | "Orders" | "Reports" | "Settings";
type DrawerOption =
  | "Dashboard"
  | "New Billing"
  | "Orders"
  | "Reports"
  | "Today's Sales"
  | "Cash Summary"
  | "Add Item"
  | "Edit Price"
  | "Stock Availability"
  | "Printer Settings"
  | "User"
  | "Settings"
  | "Sync Data"
  | "Logout";

type DrawerSection = {
  title: "SALES" | "ITEMS" | "SETTINGS";
  items: DrawerOption[];
};

const drawerSections: DrawerSection[] = [
  {
    title: "SALES",
    items: ["Dashboard", "New Billing", "Orders", "Reports", "Today's Sales", "Cash Summary"]
  },
  {
    title: "ITEMS",
    items: ["Add Item", "Edit Price", "Stock Availability"]
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
  subItems?: string[];
};

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

  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [cartCount, setCartCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOption, setActiveOption] = useState<DrawerOption>("Dashboard");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [catalog, setCatalog] = useState<Product[]>(products);
  const drawerProgress = useRef(new Animated.Value(0)).current;

  const visibleProducts = useMemo(
    () => catalog.filter(item => activeCategory === "All" || item.category === activeCategory),
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
      Home: "Dashboard",
      Orders: "Orders",
      Reports: "Reports",
      Settings: "Settings"
    };
    setActiveOption(nextOption[item]);
  }, []);

  const showBillingGrid = activeOption === "Dashboard" || activeOption === "New Billing";

  return (
    <SafeAreaView style={styles.safe}>
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
              { paddingHorizontal: horizontalPadding, paddingBottom: 184 }
            ]}
            columnWrapperStyle={columns > 1 ? { gap: cardGap } : undefined}
            ListHeaderComponent={
              <>
                <SearchBar />
                <CategoryTabs active={activeCategory} onChange={setActiveCategory} />
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
          <Text style={styles.connected}>Connected</Text>
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
                  <Text style={styles.connected}>Connected</Text>
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
  onProductsChange
}: {
  option: DrawerOption;
  horizontalPadding: number;
  products: Product[];
  onProductsChange: (next: Product[]) => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.optionContent, { paddingHorizontal: horizontalPadding, paddingBottom: 184 }]}
    >
      <Text style={styles.optionTitle}>{option}</Text>
      {option === "Orders" && <OrdersScreen />}
      {option === "Reports" && <ReportsScreen products={products} />}
      {option === "Today's Sales" && <TodaysSalesScreen />}
      {option === "Cash Summary" && <CashSummaryScreen />}
      {option === "Add Item" && <ItemManagerScreen products={products} onProductsChange={onProductsChange} />}
      {option === "Edit Price" && <ItemManagerScreen products={products} onProductsChange={onProductsChange} />}
      {option === "Stock Availability" && <StockAvailabilityScreen products={products} />}
      {option === "Printer Settings" && <PrinterSettingsScreen />}
      {option === "User" && <UserScreen />}
      {option === "Settings" && <SettingsScreen />}
      {option === "Sync Data" && <SyncDataScreen />}
      {option === "Logout" && <LogoutScreen />}
    </ScrollView>
  );
}

function OrdersScreen() {
  return (
    <View style={styles.optionStack}>
      {[
        ["#10131", "2 items", "Rs 8,245", "Paid"],
        ["#10122", "1 item", "Rs 235", "Pending"],
        ["#10144", "4 items", "Rs 530", "Paid"]
      ].map(row => (
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

function ReportsScreen({ products }: { products: Product[] }) {
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2026-07-11");
  const quickRanges: Record<string, [string, string]> = {
    Today: ["2026-07-11", "2026-07-11"],
    Week: ["2026-07-05", "2026-07-11"],
    Month: ["2026-07-01", "2026-07-11"],
    Year: ["2026-01-01", "2026-07-11"],
    Custom: [fromDate, toDate]
  };

  const itemReports = useMemo(() => products.map((item, index) => {
    const quantity = (index + 2) * 4;
    const discount = index % 2 === 0 ? 10 : 0;
    const gross = quantity * item.price;
    return {
      ...item,
      quantity,
      gross,
      discount,
      net: gross - discount
    };
  }), [products]);

  const totalSales = itemReports.reduce((sum, item) => sum + item.net, 0);
  const totalQty = itemReports.reduce((sum, item) => sum + item.quantity, 0);
  const avgBill = Math.round(totalSales / Math.max(itemReports.length, 1));
  const cash = Math.round(totalSales * 0.52);
  const upi = Math.round(totalSales * 0.38);
  const card = totalSales - cash - upi;

  const categoryReports = itemCategories.map(category => {
    const rows = itemReports.filter(item => item.category === category);
    return {
      label: category,
      qty: rows.reduce((sum, item) => sum + item.quantity, 0),
      amount: rows.reduce((sum, item) => sum + item.net, 0)
    };
  });

  const dailyReports = [
    ["2026-07-07", "Rs 4,840", "62 bills"],
    ["2026-07-08", "Rs 5,260", "71 bills"],
    ["2026-07-09", "Rs 6,110", "78 bills"],
    ["2026-07-10", "Rs 5,980", "74 bills"],
    ["2026-07-11", `Rs ${totalSales}`, `${totalQty} qty`]
  ];

  const hourlyReports = [
    ["07-09 AM", "Breakfast", "Rs 2,180"],
    ["09-12 PM", "Tea Rush", "Rs 1,420"],
    ["12-03 PM", "Lunch", "Rs 3,760"],
    ["03-06 PM", "Snacks", "Rs 1,980"]
  ];

  return (
    <View style={styles.optionStack}>
      <View style={styles.reportFilterCard}>
        <View style={styles.dateRow}>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>From Date</Text>
            <TextInput value={fromDate} onChangeText={setFromDate} style={styles.dateInput} />
          </View>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>To Date</Text>
            <TextInput value={toDate} onChangeText={setToDate} style={styles.dateInput} />
          </View>
        </View>
        <View style={styles.quickRangeRow}>
          {["Today", "Week", "Month", "Year", "Custom"].map(item => (
            <TouchableOpacity
              key={item}
              activeOpacity={0.85}
              onPress={() => {
                setFromDate(quickRanges[item][0]);
                setToDate(quickRanges[item][1]);
              }}
              style={styles.quickRangeChip}
            >
              <Text style={styles.quickRangeText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.reportGrid}>
        <ReportMetric label="Total Sale" value={`Rs ${totalSales}`} />
        <ReportMetric label="Items Sold" value={String(totalQty)} />
        <ReportMetric label="Avg Bill" value={`Rs ${avgBill}`} />
        <ReportMetric label="Reports" value="8" />
      </View>

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

      <ReportSection title="Stock & Profit">
        <ReportRow label="Low Stock Items" value="2" detail="Need refill" />
        <ReportRow label="Estimated Profit" value={`Rs ${Math.round(totalSales * 0.32)}`} detail="After cost" />
        <ReportRow label="Discount Given" value={`Rs ${itemReports.reduce((sum, item) => sum + item.discount, 0)}`} detail="Selected bills" />
      </ReportSection>
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

function ItemManagerScreen({
  products,
  onProductsChange
}: {
  products: Product[];
  onProductsChange: (next: Product[]) => void;
}) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Meals");
  const [newPrice, setNewPrice] = useState("");
  const [newSubItem, setNewSubItem] = useState("");
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});

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
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80"
    };
    onProductsChange([...products, nextProduct]);
    setNewName("");
    setNewPrice("");
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
          {itemCategories.map(category => (
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
            <Image source={{ uri: item.image }} style={styles.manageImage} />
            <View style={styles.manageInfo}>
              <Text style={styles.listTitle}>{item.name}</Text>
              <Text style={styles.listSub}>{item.category}</Text>
            </View>
            <View style={styles.editPriceBox}>
              <Text style={styles.editPriceLabel}>Edit Price</Text>
              <TextInput
                value={String(item.price)}
                onChangeText={value => updateProduct(item.id, { price: Number(value) || 0 })}
                keyboardType="numeric"
                style={styles.priceInput}
              />
            </View>
          </View>

          <View style={styles.subItemsWrap}>
            {(item.subItems && item.subItems.length > 0) ? item.subItems.map(subItem => (
              <View key={subItem} style={styles.subPill}>
                <Text style={styles.subPillText}>{subItem}</Text>
              </View>
            )) : (
              <Text style={styles.listSub}>Empty</Text>
            )}
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

function SettingsScreen() {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Operational Settings</Text>
      <InfoRow label="Outlet" value="Main Canteen" />
      <InfoRow label="Currency" value="Rs" />
      <InfoRow label="Tax" value="0%" />
      <InfoRow label="Compact Mode" value="ON" />
      <TouchableOpacity style={styles.primaryAction}><Text style={styles.primaryActionText}>Save Changes</Text></TouchableOpacity>
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

const CategoryTabs = memo(function CategoryTabs({ active, onChange }: { active: Category; onChange: (value: Category) => void }) {
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

      <TouchableOpacity activeOpacity={0.9} style={styles.payButton}>
        <Text style={styles.payText}>Proceed to Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

function BottomNav({ activeOption, onSelect }: { activeOption: DrawerOption; onSelect: (item: BottomNavItem) => void }) {
  const items: BottomNavItem[] = ["Home", "Orders", "Reports", "Settings"];
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
            <Text style={[styles.navText, active && styles.navActiveText]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE
  },
  page: {
    flex: 1,
    backgroundColor: PAGE
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
    color: NAVY,
    fontSize: 20,
    fontWeight: "900"
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    gap: 9
  },
  statusDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: GREEN
  },
  connected: {
    color: GREEN,
    fontSize: 16,
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
  quickRangeText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "900"
  },
  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  reportMetric: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 76,
    borderRadius: 16,
    padding: 13,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    justifyContent: "center"
  },
  reportMetricValue: {
    color: NAVY,
    fontSize: 19,
    fontWeight: "900"
  },
  reportMetricLabel: {
    marginTop: 5,
    color: MUTED,
    fontSize: 12,
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
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 30
  },
  subSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  manageInfo: {
    flex: 1,
    marginLeft: 11
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
    bottom: 82,
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
  payButton: {
    minHeight: 54,
    marginTop: 16,
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
    height: 58,
    borderRadius: 18,
    backgroundColor: NAVY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8
  },
  navItem: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  navActive: {
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  navText: {
    color: CARD,
    fontSize: 13,
    fontWeight: "900"
  },
  navActiveText: {
    color: CARD
  },
  drawerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
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
