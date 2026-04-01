import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../AuthContext';

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SwapU</Text>
      <Text style={styles.tagline}>Trade stuff on campus</Text>
      
      <View style={styles.welcomeBox}>
        <Text style={styles.welcomeText}>Welcome back!</Text>
        <Text style={styles.emailText}>{user?.email}</Text>
      </View>

      <View style={styles.buttonContainer}>
        {/* Navigate to TradeTab → TradeStack → Swipe (but start at SelectTradeItem) */}
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('TradeTab', { screen: 'SelectTradeItem' })}
        >
          <Text style={styles.buttonText}>Browse Items</Text>
        </TouchableOpacity>
        
        {/* Navigate to PostTab */}
        <TouchableOpacity 
          style={[styles.button, styles.outlineButton]}
          onPress={() => navigation.navigate('Post')}
        >
          <Text style={[styles.buttonText, styles.outlineText]}>Post an Item</Text>
        </TouchableOpacity>
        
        {/* Navigate to MyItems (same stack) */}
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('MyItems')}
        >
          <Text style={[styles.buttonText, styles.secondaryText]}>My Items</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  welcomeBox: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
  },
  emailText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  outlineButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  outlineText: {
    color: '#000',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryText: {
    color: '#fff',
  },
  signOutButton: {
    marginTop: 20,
    padding: 15,
  },
  signOutText: {
    color: '#999',
    fontSize: 14,
  },
});