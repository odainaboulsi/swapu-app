import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';

export default function SelectTradeItemScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchMyItems();
  }, []);

  const fetchMyItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectItem = (item) => {
    navigation.navigate('Swipe', { myItem: item });
  };

  const getConditionColor = (condition) => {
    switch(condition) {
      case 'New': return '#4CAF50';
      case 'Like New': return '#81C784';
      case 'Good': return '#FFB74D';
      case 'Fair': return '#E57373';
      default: return '#999';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Loading your items...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>No items to trade</Text>
        <Text style={styles.subText}>Post an item first, then come back to trade!</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Post')}
        >
          <Text style={styles.buttonText}>Post an Item</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>What are you trading?</Text>
      <Text style={styles.subHeader}>Select one of your items to find trade matches</Text>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.itemCard}
            onPress={() => selectItem(item)}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.itemImage} />
            ) : (
              <View style={styles.noImage} />
            )}
            
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              
              {item.condition && (
                <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(item.condition) }]}>
                  <Text style={styles.conditionText}>{item.condition}</Text>
                </View>
              )}
              
              <Text style={styles.itemCategory}>{item.category || 'Uncategorized'}</Text>
              <Text style={styles.tapHint}>Tap to trade this →</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 100,
    height: 100,
  },
  noImage: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e0e0',
  },
  itemInfo: {
    flex: 1,
    padding: 15,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  conditionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 5,
  },
  conditionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  tapHint: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 25,
    paddingHorizontal: 40,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
