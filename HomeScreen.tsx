import React, { useMemo, useRef, useState } from "react";
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

const categories = ["All", "Meals", "Tiffins", "Tea"];

const drawerSections = [
  {
    title: "SALES",
    items: ["Dashboard", "New Billing", "Orders", "Today's Sales", "Cash Summary"]
  },
  {
    title: "ITEMS",
    items: ["Add Item", "Edit Price", "Stock Availability"]
  },
  {
    title: "SETTINGS",
    items: ["Printer Settings", "Counter User", "Settings", "Sync Data"]
  }
];

const products = [
  {
    id: "1",
    name: "Chicken Pakodi",
    price: 50,
    category: "Meals",
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "2",
    name: "Tea",
    price: 15,
    category: "Tea",
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "3",
    name: "Meals",
    price: 80,
    category: "Meals",
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
    image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "6",
    name: "Coffee",
    price: 20,
    category: "Tea",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80"
  }
];

type Product = (typeof products)[number];

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
  const drawerProgress = useRef(new Animated.Value(0)).current;

  const visibleProducts = useMemo(
    () => products.filter(item => activeCategory === "All" || item.category === activeCategory),
    [activeCategory]
  );

  const addProduct = (product: Product) => {
    setCartCount(count => count + 1);
    setTotal(amount => amount + product.price);
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <Header onMenuPress={openDrawer} />

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
              <View style={styles.statsRow}>
                <StatsCard tone="green" icon="▤" label="Today's Sale" value="Rs 0" />
                <StatsCard tone="blue" icon="◷" label="Orders" value="0" />
              </View>
              <CategoryTabs active={activeCategory} onChange={setActiveCategory} />
            </>
          }
          renderItem={({ item }) => (
            <ProductCard product={item} width={productWidth} onPress={() => addProduct(item)} />
          )}
        />

        <CartPanel count={cartCount} total={total} onClear={() => { setCartCount(0); setTotal(0); }} />
        <BottomNav />
        {drawerOpen && (
          <Drawer
            width={Math.min(width * 0.82, 340)}
            progress={drawerProgress}
            onClose={closeDrawer}
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
        <Text style={styles.title}>Main Canteen</Text>
        <View style={styles.statusRow}>
          <View style={styles.greenDot} />
          <Text style={styles.connected}>Connected</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.counterButton} activeOpacity={0.85}>
        <Text style={styles.counterText}>Counter 01</Text>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>
    </View>
  );
}

function Drawer({
  width,
  progress,
  onClose
}: {
  width: number;
  progress: Animated.Value;
  onClose: () => void;
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
                <View style={styles.drawerBadge}>
                  <Text style={styles.drawerBadgeText}>Counter 01</Text>
                </View>
                <View style={styles.drawerStatus}>
                  <View style={styles.greenDot} />
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
              <Text style={styles.profileName}>Cashier Name</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineBadgeText}>Online</Text>
              </View>
            </View>
          </View>

          {drawerSections.map(section => (
            <View key={section.title} style={styles.drawerSection}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, index) => {
                  const selected = item === "Dashboard";
                  return (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.86}
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
          <TouchableOpacity activeOpacity={0.86} style={styles.logoutButton}>
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

function CategoryTabs({ active, onChange }: { active: string; onChange: (value: string) => void }) {
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
}

function ProductCard({ product, width, onPress }: { product: Product; width: number; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.productCard, { width }]}>
      <Image source={{ uri: product.image }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
        <Text style={styles.productPrice}>Rs {product.price}</Text>
      </View>
    </TouchableOpacity>
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

function BottomNav() {
  const items = ["Home", "Orders", "Reports", "Settings"];

  return (
    <View style={styles.bottomNav}>
      {items.map(item => {
        const active = item === "Home";
        return (
          <TouchableOpacity key={item} activeOpacity={0.85} style={[styles.navItem, active && styles.navActive]}>
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
    minHeight: 110,
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: CARD,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  menuButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
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
  menuIcon: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900"
  },
  logo: {
    width: 58,
    height: 58,
    marginLeft: 12,
    borderRadius: 29,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center"
  },
  logoIcon: {
    color: CARD,
    fontSize: 24,
    fontWeight: "900"
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12
  },
  title: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900"
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GREEN,
    marginRight: 7
  },
  connected: {
    color: GREEN,
    fontSize: 14,
    fontWeight: "800"
  },
  counterButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#eef0f5",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  counterText: {
    color: "#667085",
    fontSize: 13,
    fontWeight: "900"
  },
  chevron: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  content: {
    paddingTop: 16
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
    fontWeight: "950"
  },
  textGreen: {
    color: "#168a2f"
  },
  textBlue: {
    color: "#165dcc"
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
    fontWeight: "950"
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
    fontWeight: "950"
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
    fontWeight: "950"
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
    fontWeight: "950"
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
    fontWeight: "950"
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
    fontWeight: "950"
  },
  profileTextBlock: {
    flex: 1,
    marginLeft: 12
  },
  profileName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "950"
  },
  onlineBadge: {
    alignSelf: "flex-start",
    minHeight: 25,
    marginTop: 7,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: "#ecfdf3",
    flexDirection: "row",
    alignItems: "center"
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: GREEN
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
    fontWeight: "950",
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
    fontWeight: "950"
  },
  drawerItemIconTextSelected: {
    color: CARD
  },
  drawerItemText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "850"
  },
  drawerItemTextSelected: {
    color: NAVY,
    fontWeight: "950"
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
    fontWeight: "950"
  },
  versionText: {
    marginTop: 10,
    color: "#98a2b3",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800"
  }
});
