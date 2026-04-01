import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet, Dimensions } from 'react-native';
import { AuthProvider, useAuth } from './AuthContext';
import HomeScreen from './screens/HomeScreen';
import SwipeScreen from './screens/SwipeScreen';
import PostScreen from './screens/PostScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import MyItemsScreen from './screens/MyItemsScreen';
import SelectTradeItemScreen from './screens/SelectTradeItemScreen';
import MatchScreen from './screens/MatchScreen';
import MyMatchesScreen from './screens/MyMatchesScreen';
import OffersScreen from './screens/OffersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const { width } = Dimensions.get('window');

// Simple icon component
const TabIcon = ({ emoji, label, focused }) => (
  <View style={styles.tabIconContainer}>
    <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{emoji}</Text>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

// Home stack (includes MyItems as regular screen)
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="MyItems" component={MyItemsScreen} />
    </Stack.Navigator>
  );
}

// Trade stack (SelectTradeItem → Swipe)
function TradeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SelectTradeItem" component={SelectTradeItemScreen} />
      <Stack.Screen name="Swipe" component={SwipeScreen} />
    </Stack.Navigator>
  );
}

// Matches stack (MyMatches list)
function MatchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyMatches" component={MyMatchesScreen} />
    </Stack.Navigator>
  );
}

// NEW ORDER: Home → Trade → Offers → Matches → My Items
// PostTab removed from bottom nav
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="TradeTab" 
        component={TradeStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔁" label="Trade" focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="OffersTab" 
        component={OffersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📬" label="Offers" focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="MatchesTab" 
        component={MatchesStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💝" label="Matches" focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="MyItemsTab" 
        component={MyItemsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📦" label="My Items" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Auth stack
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Match" component={MatchScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Post" component={PostScreen} options={{ presentation: 'card' }} />

          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
    width: width / 5,
  },
  tabEmoji: {
    fontSize: 24,
    marginBottom: 2,
    opacity: 0.5,
  },
  tabEmojiFocused: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    width: '100%',
  },
  tabLabelFocused: {
    color: '#000',
    fontWeight: '600',
  },
});
