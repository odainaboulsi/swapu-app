import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Dimensions, 
  Image, 
  TouchableOpacity, 
  Modal, 
  Alert 
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useTokens } from '../hooks/useTokens';

const { width, height } = Dimensions.get('window');

const CASH_OPTIONS = [0, 5, 10, 15, 20, 25];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const formatDistance = (miles) => {
  if (miles === null || miles === undefined) return 'Nearby';
  if (miles < 0.1) return 'Same campus';
  if (miles < 0.5) return 'Very close';
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft away`;
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
};

export default function SwipeScreen({ route, navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashModal, setShowCashModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedCash, setSelectedCash] = useState(0);
  const [isSuperOffer, setIsSuperOffer] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [imageIndexes, setImageIndexes] = useState({}); // Track current photo index per item
  
  const swiperRef = useRef(null);
  const { user } = useAuth();
  const { balance, spendTokens, refresh: refreshTokens } = useTokens();
  
  const myItem = route.params?.myItem;

  useEffect(() => {
    if (!myItem) {
      navigation.replace('SelectTradeItem');
      return;
    }
    getUserLocation();
    refreshTokens();
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
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .neq('user_id', 'anonymous')
        .not('user_id', 'is', null)
        .neq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .eq('status', 'available');
      
      if (error) throw error;
      
      // Process items with distance
      const processedItems = (data || []).map((item) => {
        const distance = calculateDistance(
          userLocation?.latitude,
          userLocation?.longitude,
          item.latitude,
          item.longitude
        );
        
        return {
          ...item,
          distance: distance,
          distanceText: formatDistance(distance),
          // Handle both old single image and new array format
          images: item.image_urls && item.image_urls.length > 0 
            ? item.image_urls 
            : item.image_url 
              ? [item.image_url] 
              : []
        };
      });

      processedItems.sort((a, b) => {
        if (a.distance !== null && b.distance !== null) {
          return a.distance - b.distance;
        }
        return 0;
      });
      
      setItems(processedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Photo navigation functions
  const goToNextImage = useCallback((itemId) => {
    setImageIndexes(prev => {
      const currentIndex = prev[itemId] || 0;
      const item = items.find(i => i.id === itemId);
      const maxIndex = item?.images?.length ? item.images.length - 1 : 0;
      
      if (currentIndex < maxIndex) {
        return { ...prev, [itemId]: currentIndex + 1 };
      }
      return prev;
    });
  }, [items]);

  const goToPrevImage = useCallback((itemId) => {
    setImageIndexes(prev => {
      const currentIndex = prev[itemId] || 0;
      
      if (currentIndex > 0) {
        return { ...prev, [itemId]: currentIndex - 1 };
      }
      return prev;
    });
  }, []);

  const handleRegularOffer = (cardIndex) => {
    const item = items[cardIndex];
    setCurrentItem(item);
    setIsSuperOffer(false);
    setSelectedCash(0);
    setShowCashModal(true);
  };

  const handleSuperOffer = (cardIndex) => {
    const item = items[cardIndex];
    
    if (balance < 1) {
      Alert.alert(
        'Not enough tokens',
        'You need 1 token to send a Super Offer.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setCurrentItem(item);
    setIsSuperOffer(true);
    setSelectedCash(0);
    setShowCashModal(true);
  };

  const handleSwipeLeft = (cardIndex) => {
    console.log('Passed on:', items[cardIndex]?.title);
  };

  const submitOffer = async () => {
    setShowCashModal(false);
    
    try {
      let likeId = null;
      
      const likeData = {
        user_id: user.id,
        item_id: currentItem.id,
        my_item_id: myItem.id,
        cash_offer: selectedCash,
        is_super: isSuperOffer,
        is_unlocked: isSuperOffer,
        is_viewed: false,
        status: 'pending'
      };
      
      const { data: insertedLike, error: insertError } = await supabase
        .from('likes')
        .insert(likeData)
        .select()
        .single();
      
      if (insertError) throw insertError;
      likeId = insertedLike.id;
      
      if (isSuperOffer) {
        const result = await spendTokens(1, 'super_offer', likeId);
        if (!result.success) {
          await supabase.from('likes').delete().eq('id', likeId);
          Alert.alert('Error', 'Could not process Super Offer.');
          return;
        }
      }

      const { data: mutualLikes } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', currentItem.user_id)
        .eq('item_id', myItem.id)
        .eq('my_item_id', currentItem.id)
        .eq('status', 'pending');

      if (mutualLikes && mutualLikes.length > 0) {
        navigation.navigate('Match', { 
          theirItem: currentItem, 
          myItem: myItem,
          theirCashOffer: mutualLikes[0].cash_offer || 0,
          myCashOffer: selectedCash
        });
      } else {
        Alert.alert(
          isSuperOffer ? '⭐ Super Offer Sent!' : 'Offer Sent',
          isSuperOffer 
            ? 'They\'ll see your offer immediately with full details!'
            : 'Offer sent! Waiting for them to respond...'
        );
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Something went wrong. Try again!');
    }
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

  // Render card with photo tap zones
  const renderCard = (item) => {
    const currentImageIndex = imageIndexes[item.id] || 0;
    const hasMultipleImages = item.images.length > 1;
    const currentImageUrl = item.images[currentImageIndex] || item.image_url;
    
    return (
      <View style={styles.card}>
        {/* Top bar with badges */}
        <View style={styles.topBar}>
          <View style={styles.leftBadges}>
            {item.condition && (
              <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(item.condition) }]}>
                <Text style={styles.badgeText}>{item.condition}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>📍 {item.distanceText}</Text>
          </View>
        </View>
        
        {/* Image Container with Tap Zones */}
        <View style={styles.imageContainer}>
          {currentImageUrl ? (
            <Image 
              source={{ uri: currentImageUrl }} 
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          
          {/* Photo Progress Indicator */}
          {hasMultipleImages && (
            <View style={styles.progressContainer}>
              {item.images.map((_, idx) => (
                <View 
                  key={idx} 
                  style={[
                    styles.progressDot,
                    idx === currentImageIndex && styles.progressDotActive
                  ]} 
                />
              ))}
            </View>
          )}
          
          {/* Photo Counter */}
          {hasMultipleImages && (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>
                {currentImageIndex + 1}/{item.images.length}
              </Text>
            </View>
          )}
          
          {/* Invisible Tap Zones - Only if multiple images */}
          {hasMultipleImages && (
            <>
              {/* Left Zone - Previous */}
              <TouchableOpacity 
                style={[styles.navZone, styles.navZoneLeft]}
                onPress={() => goToPrevImage(item.id)}
                activeOpacity={1}
              />
              
              {/* Right Zone - Next */}
              <TouchableOpacity 
                style={[styles.navZone, styles.navZoneRight]}
                onPress={() => goToNextImage(item.id)}
                activeOpacity={1}
              />
            </>
          )}
        </View>
        
        {/* Card Content */}
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          {item.interested_in_tags && item.interested_in_tags.length > 0 && (
            <View style={styles.tagsRow}>
              <Text style={styles.tagsLabel}>Want: </Text>
              <Text style={styles.tagsText} numberOfLines={1}>
                {item.interested_in_tags.slice(0, 3).join(', ')}
                {item.interested_in_tags.length > 3 && '...'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
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
        <Text style={styles.subText}>No items available. Check back later!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.tradeItemInfo}>
          <Text style={styles.tradingLabel}>Trading:</Text>
          <Text style={styles.tradingItem} numberOfLines={1}>{myItem?.title}</Text>
        </View>
        <View style={styles.tokenBalance}>
          <Text style={styles.tokenText}>🪙 {balance}</Text>
        </View>
      </View>

      <Text style={styles.subHeader}>{items.length} items nearby</Text>
      
      {/* Swiper */}
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={items}
          renderCard={renderCard}
          onSwipedRight={handleRegularOffer}
          onSwipedLeft={handleSwipeLeft}
          onSwipedTop={handleSuperOffer}
          cardIndex={0}
          backgroundColor={'transparent'}
          stackSize={3}
          infinite={true}
          showSecondCard={true}
          verticalSwipe={true}
          verticalThreshold={100}
          horizontalThreshold={100}
          overlayLabels={{
            left: {
              title: 'PASS',
              style: {
                label: { backgroundColor: 'red', color: 'white', fontSize: 24, borderRadius: 10, padding: 10, fontWeight: 'bold' },
                wrapper: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 20, marginLeft: -20 }
              }
            },
            right: {
              title: 'TRADE',
              style: {
                label: { backgroundColor: 'green', color: 'white', fontSize: 24, borderRadius: 10, padding: 10, fontWeight: 'bold' },
                wrapper: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 20, marginLeft: 20 }
              }
            },
            top: {
              title: '⭐ SUPER',
              style: {
                label: { backgroundColor: '#FFD700', color: '#000', fontSize: 24, borderRadius: 10, padding: 10, fontWeight: 'bold' },
                wrapper: { flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }
              }
            }
          }}
        />
      </View>
      
      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.passButton]}
          onPress={() => swiperRef.current?.swipeLeft()}
        >
          <Text style={styles.actionText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.superButton]}
          onPress={() => handleSuperOffer(0)}
        >
          <Text style={styles.superEmoji}>⭐</Text>
          <Text style={styles.superLabel}>1 🪙</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => swiperRef.current?.swipeRight()}
        >
          <Text style={styles.actionText}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>
        Swipe left to pass • Right to offer • Up for Super
      </Text>

      {/* Cash Offer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCashModal}
        onRequestClose={() => setShowCashModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isSuperOffer ? '⭐ Super Offer' : 'Make an Offer'}
            </Text>
            
            {isSuperOffer && (
              <View style={styles.superBadge}>
                <Text style={styles.superBadgeText}>Costs 1 token • Unlocked immediately</Text>
              </View>
            )}

            <Text style={styles.modalSubtitle}>
              Your {myItem?.title} for their {currentItem?.title}
            </Text>

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
                    {amount === 0 ? 'No Cash' : `+$${amount}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCashModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, isSuperOffer && styles.superConfirmButton]}
                onPress={submitOffer}
              >
                <Text style={styles.confirmButtonText}>
                  {isSuperOffer ? 'Send Super (1 🪙)' : 'Send Offer'}
                </Text>
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
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  },
  tradeItemInfo: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tradingLabel: {
    fontSize: 11,
    color: '#666',
  },
  tradingItem: {
    fontSize: 14,
    fontWeight: '600',
  },
  tokenBalance: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  tokenText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subHeader: {
    fontSize: 14,
    color: '#666',
    marginTop: 110,
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
    alignItems: 'center',
    zIndex: 10,
  },
  leftBadges: {
    flexDirection: 'row',
  },
  conditionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  distanceBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Image container with tap zones
  imageContainer: {
    width: '100%',
    height: height * 0.3,
    position: 'relative',
    marginTop: 60,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 18,
  },
  // Progress indicator
  progressContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 5,
  },
  progressDot: {
    height: 4,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: '#fff',
  },
  // Photo counter
  photoCounter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  photoCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Invisible tap zones
  navZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 10,
  },
  navZoneLeft: {
    left: 0,
  },
  navZoneRight: {
    right: 0,
  },
  // Card content
  cardContent: {
    padding: 20,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsLabel: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  tagsText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 20,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  passButton: {
    backgroundColor: '#ff4444',
  },
  superButton: {
    backgroundColor: '#FFD700',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },
  actionText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  superEmoji: {
    fontSize: 28,
  },
  superLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  instructions: {
    marginTop: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#666',
    fontSize: 13,
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
  superBadge: {
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  superBadgeText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  cashOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cashButton: {
    width: 70,
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  cashButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  cashButtonText: {
    fontSize: 14,
    color: '#333',
  },
  cashButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
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
  superConfirmButton: {
    backgroundColor: '#FFD700',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
