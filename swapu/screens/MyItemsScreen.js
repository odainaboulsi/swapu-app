import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, 
  Alert, ActivityIndicator, RefreshControl 
} from 'react-native';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { useIsFocused } from '@react-navigation/native';

export default function MyItemsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const isFocused = useIsFocused();

  // Auto-refresh when screen comes into focus
  useEffect(() => {
    if (isFocused) {
      console.log('Screen focused, fetching items');
      loadItems();
    }
  }, [isFocused]);

  const loadItems = async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else if (!refreshing) {
      setLoading(true);
    }
    
    try {
      console.log('Loading items from Supabase...');
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('Loaded items:', data?.length || 0);
      setItems(data || []);
      
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Could not load your items');
    } finally {
      console.log('Done loading, resetting states');
      setLoading(false);
      setRefreshing(false);
    }
  };

  // This is the key - define it simply without useCallback
  const onRefresh = () => {
    console.log('Pull to refresh triggered!');
    loadItems(true);
  };

  const deleteItem = async (itemId) => {
    Alert.alert(
      'Delete Item?',
      'Are you sure you want to remove this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('items')
                .delete()
                .eq('id', itemId);
              
              if (error) throw error;
              
              setItems(items.filter(item => item.id !== itemId));
              Alert.alert('Deleted', 'Item removed successfully');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const formatValue = (item) => {
    if (item.value_tier) return item.value_tier;
    if (item.value_min !== null && item.value_max !== null) {
      return `$${item.value_min}-${item.value_max}`;
    }
    return 'Value not set';
  };

  const startTrading = (item) => {
    navigation.navigate('TradeTab', {
      screen: 'Swipe',
      params: { myItem: item }
    });
  };

  if (loading && !refreshing && items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Items</Text>
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 50 }} />
        <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading your items...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Items</Text>
      
      {items.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No available items. Post an item or check completed trades.</Text>
          <TouchableOpacity 
            style={styles.postButton}
            onPress={() => navigation.navigate('Post')}
          >
            <Text style={styles.postButtonText}>+ Post New Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity 
            style={styles.postButtonTop}
            onPress={() => navigation.navigate('Post')}
          >
            <Text style={styles.postButtonText}>+ Post New Item</Text>
          </TouchableOpacity>
          
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#000"
                title={refreshing ? "Refreshing..." : "Pull to refresh"}
                titleColor="#666"
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.itemCard}
                onPress={() => startTrading(item)}
                activeOpacity={0.7}
              >
                {item.image_url ? (
                  <Image 
                    source={{ uri: item.image_url }} 
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noImage}>
                    <Text style={styles.noImageText}>No Image</Text>
                  </View>
                )}
                
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemValue}>{formatValue(item)}</Text>
                  <Text style={styles.itemCategory} numberOfLines={1}>
                    {item.category || 'Uncategorized'}
                  </Text>
                  <Text style={styles.itemDate}>
                    Posted {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.tapHint}>Tap to trade this →</Text>
                </View>

                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                >
                  <Text style={styles.deleteText}>🗑</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </>
      )}
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
    marginBottom: 20,
  },
  postButtonTop: {
    backgroundColor: '#000',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  postButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 25,
    paddingHorizontal: 40,
    width: '80%',
    alignItems: 'center',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#666',
    fontSize: 12,
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
  itemValue: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 3,
  },
  itemCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  itemDate: {
    fontSize: 12,
    color: '#999',
  },
  tapHint: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 4,
  },
  deleteButton: {
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  deleteText: {
    fontSize: 24,
  },
});
