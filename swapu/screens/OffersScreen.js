// screens/OffersScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Alert } from 'react-native';
import { useAuth } from '../AuthContext';
import { useTokens } from '../hooks/useTokens';
import { supabase } from '../supabase';
import { useIsFocused } from '@react-navigation/native';

export default function OffersScreen({ navigation }) {
  const { user } = useAuth();
  const { balance, spendTokens, refresh: refreshTokens } = useTokens();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadOffers();
    }
  }, [isFocused]);

  const loadOffers = async () => {
    try {
      setLoading(true);
      
      // Get offers on user's items
      const { data: offersData, error: offersError } = await supabase
        .from('likes')
        .select(`
          *,
          item:items!item_id(*),
          my_item:items!my_item_id(*)
        `)
        .eq('item.user_id', user.id)
        .eq('status', 'pending')
        .order('is_super', { ascending: false })
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;

      // Process offers
      const processedOffers = (offersData || []).map(offer => ({
        ...offer,
        theirItem: offer.my_item, // The item they're offering
        yourItem: offer.item, // Your item they want
      }));

      setOffers(processedOffers);
    } catch (error) {
      console.error('Error loading offers:', error);
      Alert.alert('Error', 'Could not load offers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnlock = async (offer) => {
    if (offer.is_unlocked) return;
    
    const result = await spendTokens(1, 'unlock', offer.id);
    
    if (!result.success) {
      Alert.alert('Not enough tokens', 'You need 1 token to unlock this offer.');
      return;
    }
    
    // Update offer in DB
    await supabase
      .from('likes')
      .update({ is_unlocked: true, is_viewed: true })
      .eq('id', offer.id);
    
    // Refresh
    loadOffers();
  };

  const handleAccept = async (offer) => {
    // Navigate to match screen with offer details
    navigation.navigate('Match', {
      theirItem: offer.theirItem,
      myItem: offer.yourItem,
      theirCashOffer: offer.cash_offer,
      myCashOffer: 0,
      offerId: offer.id,
      isFromOffer: true
    });
  };

  const renderOffer = ({ item: offer }) => {
    const isSuper = offer.is_super;
    const isUnlocked = offer.is_unlocked || isSuper;
    
    return (
      <View style={styles.offerCard}>
        {/* Status Badge */}
        {isSuper && (
          <View style={styles.superBadge}>
            <Text style={styles.superText}>⭐ SUPER OFFER</Text>
          </View>
        )}
        
        {/* Your Item (being requested) */}
        <View style={styles.yourItemSection}>
          <Text style={styles.sectionLabel}>They want your:</Text>
          <Text style={styles.yourItemTitle}>{offer.yourItem?.title}</Text>
          <Text style={styles.yourItemCategory}>{offer.yourItem?.category}</Text>
        </View>
        
        {/* Their Offer (what they give) */}
        <View style={styles.theirOfferSection}>
          <Text style={styles.sectionLabel}>In exchange for:</Text>
          
          {isUnlocked ? (
            // Unlocked view
            <>
              {offer.theirItem?.image_url && (
                <Image 
                  source={{ uri: offer.theirItem.image_url }} 
                  style={styles.offerImage}
                />
              )}
              <Text style={styles.theirItemTitle}>{offer.theirItem?.title}</Text>
              <Text style={styles.theirItemCategory}>{offer.theirItem?.category}</Text>
              {offer.cash_offer > 0 && (
                <Text style={styles.cashOffer}>+ ${offer.cash_offer} cash</Text>
              )}
            </>
          ) : (
            // Locked view
            <View style={styles.lockedView}>
              <View style={styles.blurredImagePlaceholder}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
              <Text style={styles.lockedCategory}>{offer.theirItem?.category || 'Unknown item'}</Text>
              {offer.cash_offer > 0 && (
                <Text style={styles.hasCashIndicator}>💵 Includes cash offer</Text>
              )}
            </View>
          )}
        </View>
        
        {/* Action Button */}
        {isUnlocked ? (
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => handleAccept(offer)}
          >
            <Text style={styles.acceptText}>Accept Trade</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.unlockButton}
            onPress={() => handleUnlock(offer)}
          >
            <Text style={styles.unlockText}>Unlock (1 🪙)</Text>
          </TouchableOpacity>
        )}
        
        {/* Offer Time */}
        <Text style={styles.timeText}>
          {new Date(offer.created_at).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>📬 Offers Inbox</Text>
        <View style={styles.center}>
          <Text>Loading offers...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Token Balance */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>📬 Offers Inbox</Text>
        <View style={styles.tokenBadge}>
          <Text style={styles.tokenText}>🪙 {balance}</Text>
        </View>
      </View>
      
      <Text style={styles.subHeader}>{offers.length} pending offers</Text>
      
      {offers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No offers yet</Text>
          <Text style={styles.emptyText}>
            When someone swipes right on your item, you'll see their offer here.
          </Text>
          <TouchableOpacity 
            style={styles.browseButton}
            onPress={() => navigation.navigate('TradeTab')}
          >
            <Text style={styles.browseButtonText}>Browse Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={offers}
          renderItem={renderOffer}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              loadOffers();
            }} />
          }
          contentContainerStyle={styles.list}
        />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  tokenBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tokenText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  list: {
    padding: 15,
  },
  offerCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  superBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  superText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  yourItemSection: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  yourItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  yourItemCategory: {
    fontSize: 14,
    color: '#4CAF50',
  },
  theirOfferSection: {
    marginBottom: 15,
  },
  offerImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  theirItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  theirItemCategory: {
    fontSize: 14,
    color: '#666',
  },
  cashOffer: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 5,
  },
  lockedView: {
    alignItems: 'center',
    padding: 20,
  },
  blurredImagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  lockIcon: {
    fontSize: 40,
  },
  lockedCategory: {
    fontSize: 16,
    color: '#666',
  },
  hasCashIndicator: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 5,
  },
  unlockButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  unlockText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  browseButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
