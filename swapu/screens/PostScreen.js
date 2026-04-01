import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Alert, 
  ActivityIndicator, 
  ScrollView, 
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const { width } = Dimensions.get('window');

const CONDITIONS = [
  { label: 'New', description: 'Never used, original packaging', color: '#4CAF50' },
  { label: 'Like New', description: 'Used once or twice, perfect condition', color: '#81C784' },
  { label: 'Good', description: 'Normal wear, fully functional', color: '#FFB74D' },
  { label: 'Fair', description: 'Visible wear, minor issues', color: '#E57373' },
];

const COMMON_TAGS = [
  'Electronics', 'Books', 'Clothing', 'Furniture', 'Gaming', 
  'Sports', 'Tickets', 'Cash', 'Textbooks', 
];

const CATEGORIES = [
  'Books & Textbooks', 'Electronics & Tech', 'Gaming', 'Clothing & Accessories',
  'Furniture & Dorm', 'Sports & Outdoors', 'Musical Instruments', 
  'Art & Supplies', 'Tickets & Events', 'Miscellaneous',
];

export default function PostScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [interestedInTags, setInterestedInTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [images, setImages] = useState([]);
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const MAX_IMAGES = 4;

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum reached', `You can only upload up to ${MAX_IMAGES} photos`);
      return;
    }

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
      setImages([...images, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum reached', `You can only upload up to ${MAX_IMAGES} photos`);
      return;
    }

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
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleTag = (tag) => {
    if (interestedInTags.includes(tag)) {
      setInterestedInTags(interestedInTags.filter(t => t !== tag));
    } else {
      setInterestedInTags([...interestedInTags, tag]);
    }
  };

  const addCustomTag = () => {
    if (customTag.trim() && !interestedInTags.includes(customTag.trim())) {
      setInterestedInTags([...interestedInTags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const removeTag = (tag) => {
    setInterestedInTags(interestedInTags.filter(t => t !== tag));
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
    setShowCategoryModal(false);
  };

  const selectCondition = (condition) => {
    setSelectedCondition(condition);
    setShowConditionModal(false);
  };

  const uploadImage = async (uri) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const fileName = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(fileName, bytes.buffer, {
        contentType: 'image/jpeg',
      });
      
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage
      .from('item-images')
      .getPublicUrl(fileName);
      
    return urlData.publicUrl;
  };

  const submitItem = async () => {
    if (images.length === 0 || !title || !selectedCondition || !selectedCategory) {
      Alert.alert('Missing info', 'Please add at least one photo, title, condition, and category');
      return;
    }
    
    try {
      setLoading(true);
      
      const imageUrls = [];
      for (const uri of images) {
        const url = await uploadImage(uri);
        imageUrls.push(url);
      }
      
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
        .insert([{
          title: title,
          description: description,
          condition: selectedCondition,
          category: selectedCategory,
          interested_in_tags: interestedInTags,
          image_urls: imageUrls,
          image_url: imageUrls[0],
          latitude: latitude,
          longitude: longitude,
          user_id: user.id,
          status: 'available'
        }])
        .select();
        
      if (error) throw error;
      
      Alert.alert('Success!', 'Your item is now live!', [
        { text: 'OK', onPress: () => navigation.navigate('MyItemsTab') }
      ]);
      
      setTitle('');
      setDescription('');
      setSelectedCondition(null);
      setSelectedCategory('');
      setInterestedInTags([]);
      setImages([]);
      
    } catch (error) {
      console.error('Full error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getConditionColor = (conditionLabel) => {
    const condition = CONDITIONS.find(c => c.label === conditionLabel);
    return condition?.color || '#999';
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Post an Item</Text>
        
        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>Photos ({images.length}/{MAX_IMAGES})</Text>
          
          <View style={styles.photoGrid}>
            {images.map((uri, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri }} style={styles.photoThumbnail} />
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={() => removeImage(index)}
                >
                  <Text style={styles.removePhotoText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            {images.length < MAX_IMAGES && (
              <View style={styles.addButtonsContainer}>
                <TouchableOpacity style={styles.addButton} onPress={takePhoto}>
                  <Text style={styles.addButtonText}>📷</Text>
                  <Text style={styles.addButtonLabel}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={pickImage}>
                  <Text style={styles.addButtonText}>🖼</Text>
                  <Text style={styles.addButtonLabel}>Library</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Title */}
        <TextInput
          style={styles.input}
          placeholder="What is it? (e.g. Biology Textbook)"
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the item (condition details, brand, size, etc.)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          editable={!loading}
        />

        {/* Condition Selector */}
        <Text style={styles.label}>Condition *</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setShowConditionModal(true)}
        >
          {selectedCondition ? (
            <View style={styles.selectedCondition}>
              <View style={[styles.conditionDot, { backgroundColor: getConditionColor(selectedCondition) }]} />
              <Text style={styles.selectedText}>{selectedCondition}</Text>
            </View>
          ) : (
            <Text style={styles.placeholderText}>Select condition...</Text>
          )}
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {/* Category Selector */}
        <Text style={styles.label}>Category *</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setShowCategoryModal(true)}
          disabled={loading}
        >
          <Text style={selectedCategory ? styles.selectedText : styles.placeholderText}>
            {selectedCategory || 'Select category...'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {/* Interested In Tags */}
        <Text style={styles.label}>Interested In Trading For</Text>
        <Text style={styles.sublabel}>Select what you'd like to receive (optional)</Text>
        
        <View style={styles.tagsContainer}>
          {COMMON_TAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tag,
                interestedInTags.includes(tag) && styles.tagSelected
              ]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[
                styles.tagText,
                interestedInTags.includes(tag) && styles.tagTextSelected
              ]}>
                {interestedInTags.includes(tag) ? '✓ ' : ''}{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Tag Input */}
        <View style={styles.customTagRow}>
          <TextInput
            style={styles.customTagInput}
            placeholder="Add custom tag..."
            value={customTag}
            onChangeText={setCustomTag}
            onSubmitEditing={addCustomTag}
          />
          <TouchableOpacity style={styles.addTagButton} onPress={addCustomTag}>
            <Text style={styles.addTagText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Tags Display */}
        {interestedInTags.length > 0 && (
          <View style={styles.selectedTagsContainer}>
            <Text style={styles.selectedTagsLabel}>Selected:</Text>
            <View style={styles.selectedTagsRow}>
              {interestedInTags.map((tag) => (
                <View key={tag} style={styles.selectedTag}>
                  <Text style={styles.selectedTagText}>{tag}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <Text style={styles.removeTag}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Submit Button */}
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
                    styles.option,
                    selectedCategory === category && styles.optionSelected
                  ]}
                  onPress={() => selectCategory(category)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedCategory === category && styles.optionTextSelected
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

        {/* Condition Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showConditionModal}
          onRequestClose={() => setShowConditionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Condition</Text>
              
              {CONDITIONS.map((condition) => (
                <TouchableOpacity
                  key={condition.label}
                  style={[
                    styles.conditionOption,
                    selectedCondition === condition.label && styles.conditionOptionSelected
                  ]}
                  onPress={() => selectCondition(condition.label)}
                >
                  <View style={styles.conditionHeader}>
                    <View style={[styles.conditionDotLarge, { backgroundColor: condition.color }]} />
                    <Text style={styles.conditionLabel}>{condition.label}</Text>
                    {selectedCondition === condition.label && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.conditionDescription}>{condition.description}</Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowConditionModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </TouchableWithoutFeedback>
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
    marginBottom: 20,
    width: '100%',
  },
  photoLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
    width: '100%',
  },
  photoContainer: {
    position: 'relative',
    width: (width - 50) / 2,
    height: (width - 50) / 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  addButtonsContainer: {
    width: '100%',
    height: 120,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    flex: 1,
    height: '100%',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 32,
    marginBottom: 8,
  },
  addButtonLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
    marginTop: 10,
  },
  sublabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  selector: {
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
  selectedCondition: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  conditionDotLarge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  selectedText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tagSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  tagText: {
    fontSize: 14,
    color: '#666',
  },
  tagTextSelected: {
    color: '#fff',
  },
  customTagRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  customTagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 10,
    marginRight: 10,
    fontSize: 16,
  },
  addTagButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectedTagsContainer: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  selectedTagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  selectedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  selectedTagText: {
    fontSize: 14,
    color: '#1976d2',
    marginRight: 5,
  },
  removeTag: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
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
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionSelected: {
    backgroundColor: '#f5f5f5',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    fontWeight: 'bold',
    color: '#000',
  },
  checkmark: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conditionOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  conditionOptionSelected: {
    backgroundColor: '#f5f5f5',
  },
  conditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  conditionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  conditionDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 26,
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
