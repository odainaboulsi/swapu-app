import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const VALUE_TIERS = [
  { label: 'Micro ($0-10)', min: 0, max: 10, description: 'Small items, accessories' },
  { label: 'Low ($10-25)', min: 10, max: 25, description: 'Books, small electronics' },
  { label: 'Medium ($25-50)', min: 25, max: 50, description: 'Textbooks, gaming gear' },
  { label: 'High ($50-100)', min: 50, max: 100, description: 'Bikes, consoles, instruments' },
  { label: 'Premium ($100+)', min: 100, max: 999999, description: 'Laptops, high-end items' },
];

const CATEGORIES = [
  'Books & Textbooks',
  'Electronics & Tech',
  'Gaming',
  'Clothing & Accessories',
  'Furniture & Dorm',
  'Sports & Outdoors',
  'Musical Instruments',
  'Art & Supplies',
  'Tickets & Events',
  'Miscellaneous',
];

export default function PostScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to photos');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
    setShowCategoryModal(false);
  };

  const submitItem = async () => {
    if (!title || !selectedTier || !image || !selectedCategory) {
      Alert.alert('Missing info', 'Please add a photo, title, value tier, and category');
      return;
    }
    
    try {
      setLoading(true);
      
      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to ArrayBuffer (works in React Native - no 0-byte files!)
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const fileName = `item-${Date.now()}.jpg`;
      
      // Upload ArrayBuffer directly
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg',
        });
        
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('item-images')
        .getPublicUrl(fileName);
        
      const imageUrl = urlData.publicUrl;
      
      let latitude = null;
      let longitude = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch (e) {
        console.log('Location not available');
      }
      
      const { error } = await supabase
        .from('items')
        .insert([
          {
            title: title,
            value_tier: selectedTier.label,
            value_min: selectedTier.min,
            value_max: selectedTier.max,
            category: selectedCategory,
            image_url: imageUrl,
            latitude: latitude,
            longitude: longitude,
            user_id: user.id,
          }
        ])
        .select();
        
      if (error) throw error;
      
      Alert.alert('Success!', 'Your item is now live!', [
        { text: 'OK', onPress: () => navigation.navigate('MyItemsTab') }
      ]);
      
      setTitle('');
      setSelectedTier(null);
      setSelectedCategory('');
      setImage(null);
      
    } catch (error) {
      console.error('Full error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tierLabel) => {
    if (tierLabel?.includes('Micro')) return '#81C784';
    if (tierLabel?.includes('Low')) return '#64B5F6';
    if (tierLabel?.includes('Medium')) return '#FFB74D';
    if (tierLabel?.includes('High')) return '#E57373';
    if (tierLabel?.includes('Premium')) return '#BA68C8';
    return '#999';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Post an Item</Text>
      
      <View style={styles.photoSection}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No photo selected</Text>
          </View>
        )}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.photoButton} onPress={takePhoto} disabled={loading}>
            <Text style={styles.buttonText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={pickImage} disabled={loading}>
            <Text style={styles.buttonText}>🖼 Library</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder="What is it? (e.g. Biology Textbook)"
        value={title}
        onChangeText={setTitle}
        editable={!loading}
      />

      <Text style={styles.label}>Select Value Tier:</Text>
      <Text style={styles.sublabel}>This helps find fair trades</Text>
      
      {VALUE_TIERS.map((tier) => (
        <TouchableOpacity
          key={tier.label}
          style={[
            styles.tierButton,
            selectedTier?.label === tier.label && { 
              backgroundColor: getTierColor(tier.label),
              borderColor: '#333'
            }
          ]}
          onPress={() => setSelectedTier(tier)}
          disabled={loading}
        >
          <Text style={[
            styles.tierLabel,
            selectedTier?.label === tier.label && styles.tierLabelSelected
          ]}>
            {tier.label}
          </Text>
          <Text style={[
            styles.tierDescription,
            selectedTier?.label === tier.label && styles.tierDescriptionSelected
          ]}>
            {tier.description}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Category:</Text>
      <TouchableOpacity 
        style={styles.categorySelector}
        onPress={() => setShowCategoryModal(true)}
        disabled={loading}
      >
        <Text style={selectedCategory ? styles.categoryText : styles.categoryPlaceholder}>
          {selectedCategory || 'Tap to select category...'}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.submitButton, loading && {backgroundColor: '#666'}]} 
        onPress={submitItem}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Post Item</Text>
        )}
      </TouchableOpacity>
      
      <View style={styles.bottomSpace} />

      {/* Category Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCategoryModal}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryOption,
                  selectedCategory === category && styles.categoryOptionSelected
                ]}
                onPress={() => selectCategory(category)}
              >
                <Text style={[
                  styles.categoryOptionText,
                  selectedCategory === category && styles.categoryOptionTextSelected
                ]}>
                  {category}
                </Text>
                {selectedCategory === category && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  placeholder: {
    width: 200,
    height: 200,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  buttonText: {
    color: 'white',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
    marginTop: 10,
  },
  sublabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  tierButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  tierLabelSelected: {
    color: '#fff',
  },
  tierDescription: {
    fontSize: 13,
    color: '#666',
  },
  tierDescriptionSelected: {
    color: '#fff',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  categoryText: {
    fontSize: 16,
    color: '#333',
  },
  categoryPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpace: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryOptionSelected: {
    backgroundColor: '#e8f5e9',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
  },
  categoryOptionTextSelected: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  checkmark: {
    color: '#2E7D32',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});