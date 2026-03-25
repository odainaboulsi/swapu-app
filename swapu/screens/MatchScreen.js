// screens/MatchScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';

const MEETUP_LOCATIONS = [
  { id: 1, name: 'Campus Library', address: 'Main Entrance', hours: '8AM-10PM' },
  { id: 2, name: 'Student Union', address: 'Starbucks Lobby', hours: '7AM-11PM' },
  { id: 3, name: 'Campus Police Station', address: 'Safe Exchange Zone', hours: '24/7' },
  { id: 4, name: 'University Center', address: 'Food Court', hours: '10AM-8PM' },
];

const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', 
  '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
];

export default function MatchScreen({ route, navigation }) {
  const { theirItem, myItem, theirCashOffer, myCashOffer } = route.params;
  const { user } = useAuth();
  const [step, setStep] = useState('celebrate');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [isCounterProposal, setIsCounterProposal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrCreateMatch();
  }, []);

const fetchOrCreateMatch = async () => {
  try {
    // Try to find existing match
    const { data: existingMatch, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .or(`and(user_a.eq.${user.id},user_b.eq.${theirItem.user_id}),and(user_a.eq.${theirItem.user_id},user_b.eq.${user.id})`)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
    }

    console.log('Existing match found:', existingMatch);

    if (existingMatch) {
      setMatchDetails(existingMatch);
      
      // IMPORTANT: Check status and show appropriate screen
      const isScheduled = existingMatch.status === 'scheduled' || existingMatch.status === 'pending_confirmation';
      const iScheduledIt = existingMatch.scheduled_by === user.id;
      
      console.log('Is scheduled:', isScheduled);
      console.log('I scheduled it:', iScheduledIt);
      
      if (isScheduled) {
        if (!iScheduledIt) {
          // I didn't schedule it - show me the proposal to review
          console.log('Showing review_proposal screen');
          setStep('review_proposal');
        } else {
          // I scheduled it - waiting for them
          console.log('Showing waiting_confirmation screen');
          setStep('waiting_confirmation');
        }
      }
      // else stay on 'celebrate' (default)
    } else {
      // Create new match...
      // [rest of create code]
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

  const handleScheduleMeetup = async () => {
    if (!selectedLocation || !selectedTime) {
      Alert.alert('Select Details', 'Please choose a location and time');
      return;
    }

    if (!matchDetails?.id) {
      Alert.alert('Error', 'Match not loaded. Please try again.');
      return;
    }

    setLoading(true);
    try {
      console.log('Scheduling meetup for match:', matchDetails.id);
      
      // IMPORTANT: Include ALL fields needed for the proposal system
      const updateData = {
        meetup_location: selectedLocation.name,
        meetup_address: selectedLocation.address,
        meetup_time: selectedTime,
        proposed_location: selectedLocation.name,
        proposed_address: selectedLocation.address,
        proposed_time: selectedTime,
        scheduled_by: user.id,
        status: isCounterProposal ? 'pending_confirmation' : 'scheduled',
        proposal_status: isCounterProposal ? 'countered' : 'proposed'
      };

      console.log('Update data:', updateData);

      const { data, error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchDetails.id)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      console.log('Update successful:', data);
      
      if (isCounterProposal) {
        setStep('counter_sent');
      } else {
        setStep('success');
      }
      
    } catch (error) {
      console.error('Full error:', error);
      Alert.alert('Error', error.message || 'Could not schedule meetup. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProposal = async () => {
    setLoading(true);
    try {
      // First confirm the match
      const isUserA = matchDetails.user_a === user.id;
      const updateField = isUserA ? 'user_a_confirmed' : 'user_b_confirmed';
      
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'confirmed',
          proposal_status: 'accepted',
          [updateField]: true
        })
        .eq('id', matchDetails.id);

      if (error) throw error;
      
      // Then mark items as traded
      await supabase
        .from('items')
        .update({ status: 'traded' })
        .in('id', [matchDetails.item_a, matchDetails.item_b]);
      
      setStep('success');
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Could not confirm trade');
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = () => {
    setIsCounterProposal(true);
    setStep('schedule');
  };

  const calculateCashFlow = () => {
    const net = (parseInt(theirCashOffer) || 0) - (parseInt(myCashOffer) || 0);
    if (net > 0) return `They'll pay you $${net}`;
    if (net < 0) return `You'll pay them $${Math.abs(net)}`;
    return 'Even trade - no cash';
  };

  const handleDone = () => {
    navigation.goBack();
  };

  // Celebration screen
  if (step === 'celebrate') {
    return (
      <View style={styles.celebrateContainer}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>It's a Match!</Text>
        <Text style={styles.subtitle}>You both want to trade!</Text>

        <View style={styles.tradeContainer}>
          <View style={styles.itemBox}>
            <Text style={styles.itemLabel}>You're giving:</Text>
            <Text style={styles.itemName} numberOfLines={2}>{myItem.title}</Text>
            <Text style={styles.itemValue}>{myItem.value_tier}</Text>
            {parseInt(myCashOffer) > 0 && <Text style={styles.cashTag}>+ ${myCashOffer} cash</Text>}
          </View>

          <Text style={styles.swapIcon}>⇄</Text>

          <View style={styles.itemBox}>
            <Text style={styles.itemLabel}>You're receiving:</Text>
            <Text style={styles.itemName} numberOfLines={2}>{theirItem.title}</Text>
            <Text style={styles.itemValue}>{theirItem.value_tier}</Text>
            {parseInt(theirCashOffer) > 0 && <Text style={styles.cashTag}>+ ${theirCashOffer} cash</Text>}
          </View>
        </View>

        <View style={styles.cashSummary}>
          <Text style={styles.cashSummaryText}>{calculateCashFlow()}</Text>
        </View>

        <TouchableOpacity 
          style={styles.scheduleButton}
          onPress={() => setStep('schedule')}
        >
          <Text style={styles.scheduleButtonText}>Schedule Meetup</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.laterButton}
          onPress={handleDone}
        >
          <Text style={styles.laterButtonText}>Do this later</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Review proposal from other user
  if (step === 'review_proposal') {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>📨 Meetup Proposal</Text>
        <Text style={styles.subHeader}>They suggested a time and place</Text>

        <View style={styles.proposalCard}>
          <Text style={styles.proposalLabel}>Proposed Location</Text>
          <Text style={styles.proposalValue}>📍 {matchDetails?.proposed_location}</Text>
          <Text style={styles.proposalSubtext}>{matchDetails?.proposed_address}</Text>
          
          <Text style={styles.proposalLabel}>Proposed Time</Text>
          <Text style={styles.proposalValue}>🕐 {matchDetails?.proposed_time}</Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAcceptProposal}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>✓ Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.counterButton]}
            onPress={handleCounter}
          >
            <Text style={styles.actionButtonText}>↻ Counter</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleDone}
        >
          <Text style={styles.backButtonText}>Decide Later</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Waiting for other user to confirm
  if (step === 'waiting_confirmation') {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.title}>Waiting for Confirmation</Text>
        <Text style={styles.subtitle}>They need to accept your proposal</Text>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Your Proposal</Text>
          <Text style={styles.detailsText}>
            📍 {matchDetails?.proposed_location}{'\n'}
            🕐 {matchDetails?.proposed_time}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.doneButton}
          onPress={handleDone}
        >
          <Text style={styles.doneButtonText}>Got it</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Counter proposal sent
  if (step === 'counter_sent') {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.emoji}>📤</Text>
        <Text style={styles.title}>Counter Proposal Sent!</Text>
        
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Your New Proposal</Text>
          <Text style={styles.detailsText}>
            📍 {selectedLocation?.name}{'\n'}
            🕐 {selectedTime}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.doneButton}
          onPress={handleDone}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Schedule screen
  if (step === 'schedule') {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>
          {isCounterProposal ? 'Suggest Alternative' : 'Schedule Trade Meetup'}
        </Text>
        <Text style={styles.subHeader}>
          {isCounterProposal ? 'Pick a different time or place' : 'Pick a safe public location'}
        </Text>

        <Text style={styles.sectionTitle}>📍 Location</Text>
        {MEETUP_LOCATIONS.map((loc) => (
          <TouchableOpacity
            key={loc.id}
            style={[
              styles.locationCard,
              selectedLocation?.id === loc.id && styles.locationCardSelected
            ]}
            onPress={() => setSelectedLocation(loc)}
          >
            <View style={styles.locationHeader}>
              <Text style={styles.locationName}>{loc.name}</Text>
              {loc.hours && <Text style={styles.locationHours}>{loc.hours}</Text>}
            </View>
            <Text style={styles.locationAddress}>{loc.address}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>🕐 Time</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeButton,
                selectedTime === time && styles.timeButtonSelected
              ]}
              onPress={() => setSelectedTime(time)}
            >
              <Text style={[
                styles.timeButtonText,
                selectedTime === time && styles.timeButtonTextSelected
              ]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[
            styles.confirmButton,
            (!selectedLocation || !selectedTime) && styles.confirmButtonDisabled
          ]}
          onPress={handleScheduleMeetup}
          disabled={!selectedLocation || !selectedTime || loading}
        >
          <Text style={styles.confirmButtonText}>
            {isCounterProposal ? 'Send Counter Proposal' : 'Confirm Meetup'}
          </Text>
        </TouchableOpacity>

        {isCounterProposal && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => setStep('review_proposal')}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        <View style={styles.safetyNote}>
          <Text style={styles.safetyTitle}>⚠️ Safety Tips</Text>
          <Text style={styles.safetyText}>• Meet in public during daylight</Text>
          <Text style={styles.safetyText}>• Bring a friend if possible</Text>
          <Text style={styles.safetyText}>• Inspect items before exchanging</Text>
        </View>
      </ScrollView>
    );
  }

  // Success screen
  return (
    <View style={styles.successContainer}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Meetup Scheduled!</Text>
      
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Trade Details</Text>
        <Text style={styles.detailsText}>
          📍 {matchDetails?.proposed_location || selectedLocation?.name}{'\n'}
          📍 {matchDetails?.proposed_address || selectedLocation?.address}{'\n'}
          🕐 {matchDetails?.proposed_time || selectedTime}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.doneButton}
        onPress={handleDone}
      >
        <Text style={styles.doneButtonText}>Awesome!</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  celebrateContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  tradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  itemBox: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 15,
    width: 140,
    alignItems: 'center',
  },
  itemLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  itemValue: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  cashTag: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 5,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  swapIcon: {
    fontSize: 30,
    marginHorizontal: 15,
    color: '#666',
  },
  cashSummary: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
  },
  cashSummaryText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  scheduleButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 25,
    marginBottom: 15,
  },
  scheduleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  laterButton: {
    padding: 10,
  },
  laterButtonText: {
    color: '#666',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 20,
  },
  locationCard: {
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
  },
  locationHours: {
    fontSize: 12,
    color: '#999',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 15,
    marginBottom: 20,
  },
  timeButton: {
    width: '30%',
    margin: '1.5%',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  timeButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#000',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  safetyNote: {
    backgroundColor: '#FFF3E0',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
  },
  safetyTitle: {
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 5,
  },
  safetyText: {
    fontSize: 14,
    color: '#666',
  },
  proposalCard: {
    backgroundColor: '#f5f5f5',
    margin: 20,
    padding: 20,
    borderRadius: 15,
  },
  proposalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  proposalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  proposalSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  counterButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    alignItems: 'center',
    padding: 15,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  detailsCard: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginVertical: 30,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  detailsText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 25,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
