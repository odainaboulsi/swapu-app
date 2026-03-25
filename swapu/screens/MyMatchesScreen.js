import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Image, RefreshControl 
} from 'react-native';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { useIsFocused } from '@react-navigation/native';

export default function MyMatchesScreen({ navigation }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  // Auto-refresh when screen comes into focus
  useEffect(() => {
    if (isFocused) {
      console.log('Matches screen focused, loading...');
      loadMatches();
    }
  }, [isFocused]);

  const loadMatches = async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else if (!refreshing) {
      setLoading(true);
    }
    
    try {
      console.log('Fetching matches...');
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (matchesError) throw matchesError;

      // Get item details
      const itemIds = new Set();
      (matchesData || []).forEach(match => {
        itemIds.add(match.item_a);
        itemIds.add(match.item_b);
      });

      let itemsMap = {};
      if (itemIds.size > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .in('id', Array.from(itemIds));

        if (itemsError) throw itemsError;
        itemsData?.forEach(item => itemsMap[item.id] = item);
      }

      const processedMatches = (matchesData || []).map(match => {
        const isUserA = match.user_a === user.id;
        return {
          ...match,
          myItem: isUserA ? itemsMap[match.item_a] : itemsMap[match.item_b],
          theirItem: isUserA ? itemsMap[match.item_b] : itemsMap[match.item_a],
          myCash: isUserA ? match.cash_a : match.cash_b,
          theirCash: isUserA ? match.cash_b : match.cash_a,
          iConfirmed: isUserA ? match.user_a_confirmed : match.user_b_confirmed,
          theyConfirmed: isUserA ? match.user_b_confirmed : match.user_a_confirmed,
        };
      });

      console.log('Loaded matches:', processedMatches.length);
      setMatches(processedMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Simple onRefresh without useCallback
  const onRefresh = () => {
    console.log('Pull to refresh on matches!');
    loadMatches(true);
  };

  const getStatusBadge = (match) => {
    if (match.status === 'completed') {
      return { text: '✅ Completed', color: '#4CAF50' };
    }
    if (match.iConfirmed && match.theyConfirmed) {
      return { text: '🤝 Both Confirmed', color: '#2196F3' };
    }
    if (match.iConfirmed) {
      return { text: '⏳ Awaiting them', color: '#FF9800' };
    }
    if (match.theyConfirmed) {
      return { text: '🔔 Confirm trade!', color: '#F44336' };
    }
    if (match.status === 'scheduled' || match.status === 'pending_confirmation') {
      return match.scheduled_by === user.id 
        ? { text: '⏳ Waiting for them', color: '#9C27B0' }
        : { text: '📨 Review proposal', color: '#2196F3' };
    }
    return { text: '💝 Matched', color: '#E91E63' };
  };

  const navigateToMatch = (match) => {
    navigation.navigate('Match', {
      theirItem: match.theirItem,
      myItem: match.myItem,
      theirCashOffer: match.theirCash,
      myCashOffer: match.myCash
    });
  };

  const renderMatch = ({ item: match }) => {
    const status = getStatusBadge(match);
    const netCash = match.theirCash - match.myCash;
    
    return (
      <TouchableOpacity 
        style={styles.matchCard}
        onPress={() => navigateToMatch(match)}
      >
        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>

        <View style={styles.itemsRow}>
          <View style={styles.itemPreview}>
            {match.myItem?.image_url ? (
              <Image source={{ uri: match.myItem.image_url }} style={styles.itemImage} />
            ) : (
              <View style={styles.noImage} />
            )}
            <Text style={styles.itemLabel}>You give</Text>
            <Text style={styles.itemName} numberOfLines={1}>{match.myItem?.title || 'Unknown'}</Text>
          </View>

          <View style={styles.swapCenter}>
            <Text style={styles.swapArrow}>⇄</Text>
            {netCash !== 0 && (
              <Text style={[styles.cashFlow, netCash > 0 ? styles.cashIn : styles.cashOut]}>
                {netCash > 0 ? `+$${netCash}` : `-$${Math.abs(netCash)}`}
              </Text>
            )}
          </View>

          <View style={styles.itemPreview}>
            {match.theirItem?.image_url ? (
              <Image source={{ uri: match.theirItem.image_url }} style={styles.itemImage} />
            ) : (
              <View style={styles.noImage} />
            )}
            <Text style={styles.itemLabel}>You get</Text>
            <Text style={styles.itemName} numberOfLines={1}>{match.theirItem?.title || 'Unknown'}</Text>
          </View>
        </View>

        {match.meetup_location && (
          <View style={styles.meetupInfo}>
            <Text style={styles.meetupText}>📍 {match.meetup_location}</Text>
            <Text style={styles.meetupText}>🕐 {match.meetup_time}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && matches.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Matches</Text>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Matches</Text>
      
      {matches.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💔</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <TouchableOpacity 
            style={styles.browseButton}
            onPress={() => navigation.navigate('TradeTab')}
          >
            <Text style={styles.browseButtonText}>Find Trades</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#000"
              title="Pull to refresh"
              titleColor="#666"
            />
          }
          renderItem={renderMatch}
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
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  list: {
    padding: 15,
  },
  matchCard: {
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 15,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemPreview: {
    flex: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginBottom: 8,
  },
  noImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 11,
    color: '#666',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  swapCenter: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  swapArrow: {
    fontSize: 24,
    color: '#666',
  },
  cashFlow: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
  },
  cashIn: { color: '#4CAF50' },
  cashOut: { color: '#F44336' },
  meetupInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  meetupText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
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
