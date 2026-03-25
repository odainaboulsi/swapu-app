import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Image, TouchableOpacity, Modal, Alert } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const { width, height } = Dimensions.get('window');

const CASH_OPTIONS = [0, 5, 10, 15, 20, 25];

// Calculate distance between two coordinates in miles
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Format distance for display
const formatDistance = (miles) => {
  if (miles === null || miles === undefined) return 'Nearby';
  if (miles < 0.1) return 'Same campus';
  if (miles < 0.5) return 'Very close';
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft away`;
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
};

// Get numeric tier level for comparison
const getTierLevel = (tierName) => {
  if (!tierName) return 0;
  if (tierName.includes('Micro')) return 1;
  if (tierName.includes('Low')) return 2;
  if (tierName.includes('Medium')) return 3;
  if (tierName.includes('High')) return 4;
  if (tierName.includes('Premium')) return 5;
  return 0;
};

export default function SwipeScreen({ route, navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashModal, setShowCashModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedCash, setSelectedCash] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const { user } = useAuth();
  
  // Get the item user selected to trade
  const myItem = route.params?.myItem;

  useEffect(() => {
    if (!myItem) {
      navigation.replace('SelectTradeItem');
      return;
    }
    getUserLocation();
  }, [myItem]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      }
    } catch (e) {
      console.log('Location not available');
    } finally {
      fetchItems();
    }
  };

  const fetchItems = async () => {
    try {
      console.log('Fetching items for tier:', myItem.value_tier);
      
      const myMin = myItem.value_min;
      const myMax = myItem.value_max;
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .neq('user_id', 'anonymous')
        .not('user_id', 'is', null)
        .neq('user_id', user?.id)
        .or(`value_min.gte.${myMin - 25},and(value_min.gte.${myMin},value_min.lte.${myMax + 25})`)
        .order('created_at', { ascending: false })
        .eq('status', 'available');
      
      if (error) throw error;
      
      // Process items with unique keys and distance
      const seenIds = new Set();
      const itemsWithDistance = (data || [])
        .filter(item => {
          if (!item.id || seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        })
        .map((item) => {
          const distance = calculateDistance(
            userLocation?.latitude,
            userLocation?.longitude,
            item.latitude,
            item.longitude
          );
          
          const myTierLevel = getTierLevel(myItem.value_tier);
          const theirTierLevel = getTierLevel(item.value_tier);
          
          let tierDiff = 'same';
          if (theirTierLevel > myTierLevel) tierDiff = 'above';
          else if (theirTierLevel < myTierLevel) tierDiff = 'below';
          
          return {
            ...item,
            _tierDiff: tierDiff,
            _theirTierLevel: theirTierLevel,
            _myTierLevel: myTierLevel,
            distance: distance,
            distanceText: formatDistance(distance)
          };
        });

      // Sort by distance, then tier compatibility
      itemsWithDistance.sort((a, b) => {
        if (a.distance !== null && b.distance !== null) {
          if (a.distance < 0.5 && b.distance >= 0.5) return -1;
          if (b.distance < 0.5 && a.distance >= 0.5) return 1;
          if (Math.abs(a.distance - b.distance) > 1) {
            return a.distance - b.distance;
          }
        }
        if (a._tierDiff === 'same' && b._tierDiff !== 'same') return -1;
        if (b._tierDiff === 'same' && a._tierDiff !== 'same') return 1;
        return 0;
      });
      
      console.log('Fetched items:', itemsWithDistance.length);
      setItems(itemsWithDistance);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipeRight = (cardIndex) => {
    const item = items[cardIndex];
    setCurrentItem(item);
    setSelectedCash(0);
    setShowCashModal(true);
  };

  const handleSwipeLeft = (cardIndex) => {
    console.log('Passed on:', items[cardIndex]?.title);
  };

const submitLike = async () => {
  setShowCashModal(false);
  
  try {
    // Save the like
    const { error: insertError } = await supabase
      .from('likes')
      .insert([{
        user_id: user.id,
        item_id: currentItem.id,
        my_item_id: myItem.id,
        cash_offer: selectedCash,
        status: 'pending'
      }]);

    if (insertError) throw insertError;

    // Check for mutual like
    const { data: mutualLikes, error: mutualError } = await supabase
      .from('likes')
      .select('*')
      .eq('user_id', currentItem.user_id)
      .eq('item_id', myItem.id)
      .eq('my_item_id', currentItem.id)
      .eq('status', 'pending');

    if (mutualError) throw mutualError;

    // Match found!
    if (mutualLikes && mutualLikes.length > 0) {
      navigation.navigate('Match', { 
        theirItem: currentItem, 
        myItem: myItem,
        theirCashOffer: mutualLikes[0].cash_offer || 0,
        myCashOffer: selectedCash
      });
    } else {
      alert(`Offer sent! Waiting for them to respond...`);
    }

  } catch (error) {
    console.error('Error:', error);
    alert('Something went wrong. Try again!');
  }
};


  const getTierColor = (tier) => {
    if (tier?.includes('Micro')) return '#81C784';
    if (tier?.includes('Low')) return '#64B5F6';
    if (tier?.includes('Medium')) return '#FFB74D';
    if (tier?.includes('High')) return '#E57373';
    if (tier?.includes('Premium')) return '#BA68C8';
    return '#999';
  };

  const getCashSuggestion = (item) => {
    const myTierLevel = item._myTierLevel;
    const theirTierLevel = item._theirTierLevel;
    
    if (theirTierLevel > myTierLevel) {
      const avgTheirValue = (item.value_min + item.value_max) / 2;
      const avgMyValue = (myItem.value_min + myItem.value_max) / 2;
      const diff = Math.max(0, avgTheirValue - avgMyValue);
      const maxCash = Math.min(25, Math.ceil(diff / 5) * 5);
      return `Add up to $${maxCash} to even out`;
    }
    if (theirTierLevel < myTierLevel) {
      return `They may offer you cash`;
    }
    return `Same tier - fair 1:1 trade`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Finding trade matches...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>No matches found</Text>
        <Text style={styles.subText}>No items available in your tier range. Try posting more items or check back later!</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Post')}
        >
          <Text style={styles.buttonText}>Post New Item</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tradingHeader}>
        <Text style={styles.tradingLabel}>You're trading:</Text>
        <View style={styles.myItemBadge}>
          <Text style={styles.myItemText} numberOfLines={1}>{myItem?.title}</Text>
          <View style={[styles.tierDot, { backgroundColor: getTierColor(myItem?.value_tier) }]} />
          <Text style={styles.myItemTier}>{myItem?.value_tier}</Text>
        </View>
      </View>

      <Text style={styles.header}>Swipe to Find Trades</Text>
      <Text style={styles.subHeader}>{items.length} potential matches</Text>
      
      <View style={styles.swiperContainer}>
        <Swiper
          cards={items}
          renderCard={(item) => (
            <View style={styles.card}>
              <View style={styles.topBar}>
                <View style={styles.leftBadges}>
                  <View style={[styles.tierBadge, { backgroundColor: getTierColor(item.value_tier) }]}>
                    <Text style={styles.tierBadgeText}>{item.value_tier}</Text>
                  </View>
                  {item._tierDiff !== 'same' && (
                    <View style={[styles.diffBadge, { 
                      backgroundColor: item._tierDiff === 'above' ? '#E57373' : '#81C784' 
                    }]}>
                      <Text style={styles.diffBadgeText}>
                        {item._tierDiff === 'above' ? '↑ Higher' : '↓ Lower'}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>📍 {item.distanceText}</Text>
                </View>
              </View>
              
              {item.image_url ? (
                <Image 
                  source={{ uri: item.image_url }} 
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              
              <View style={styles.cardContent}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>
                <Text style={styles.suggestion}>{getCashSuggestion(item)}</Text>
              </View>
            </View>
          )}
          onSwipedRight={handleSwipeRight}
          onSwipedLeft={handleSwipeLeft}
          cardIndex={0}
          backgroundColor={'transparent'}
          stackSize={3}
          infinite={true}
          showSecondCard={true}
          overlayLabels={{
            left: {
              title: 'PASS',
              style: {
                label: {
                  backgroundColor: 'red',
                  color: 'white',
                  fontSize: 24,
                  borderRadius: 10,
                  padding: 10,
                  fontWeight: 'bold'
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 20,
                  marginLeft: -20
                }
              }
            },
            right: {
              title: 'TRADE',
              style: {
                label: {
                  backgroundColor: 'green',
                  color: 'white',
                  fontSize: 24,
                  borderRadius: 10,
                  padding: 10,
                  fontWeight: 'bold'
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 20,
                  marginLeft: 20
                }
              }
            }
          }}
        />
      </View>
      
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          👈 Swipe left to pass
        </Text>
        <Text style={styles.instructionText}>
          Swipe right to make offer 👉
        </Text>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showCashModal}
        onRequestClose={() => setShowCashModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Make Your Offer</Text>
            
            <Text style={styles.modalSubtitle}>
              Trade your <Text style={styles.bold}>{myItem?.title}</Text> for their <Text style={styles.bold}>{currentItem?.title}</Text>
            </Text>

            <Text style={styles.cashLabel}>Cash to sweeten the deal (optional):</Text>
            
            <View style={styles.cashOptions}>
              {CASH_OPTIONS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.cashButton,
                    selectedCash === amount && styles.cashButtonSelected
                  ]}
                  onPress={() => setSelectedCash(amount)}
                >
                  <Text style={[
                    styles.cashButtonText,
                    selectedCash === amount && styles.cashButtonTextSelected
                  ]}>
                    {amount === 0 ? 'No cash\n1:1 trade' : `+$${amount}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.cashHint}>
              {selectedCash === 0 
                ? "Fair trade - no cash needed" 
                : `You're offering $${selectedCash} cash on top of your item`}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCashModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={submitLike}
              >
                <Text style={styles.confirmButtonText}>Send Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradingHeader: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tradingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  myItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myItemText: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 150,
    marginRight: 8,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  myItemTier: {
    fontSize: 12,
    color: '#666',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 80,
    marginBottom: 5,
  },
  subHeader: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  swiperContainer: {
    height: height * 0.55,
    width: width,
    alignItems: 'center',
  },
  card: {
    width: width * 0.9,
    height: height * 0.5,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  leftBadges: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  diffBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distanceBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardImage: {
    width: width * 0.9,
    height: height * 0.3,
    marginTop: 60,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: width * 0.9,
    height: height * 0.3,
    marginTop: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 18,
  },
  cardContent: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  suggestion: {
    fontSize: 13,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  instructions: {
    marginTop: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 25,
    paddingHorizontal: 40,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subText: {
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
  cashLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  cashOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 15,
  },
  cashButton: {
    width: 80,
    height: 60,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cashButtonSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  cashButtonText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  cashButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cashHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
