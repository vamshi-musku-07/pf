import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome6';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Ionicons } from '@expo/vector-icons';
import { useBackendAuth } from '@/context/BackendAuthContext';
import { BACK_TO_PROFILE } from '@/lib/navigationBack';
import { updateProfileAPI } from '@/services/ProfileApi';
import useKeyboardInset from '@/hooks/useKeyboardInset';

const Field = ({ icon, label, value, onChangeText, placeholder, keyboardType }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
      {label}
    </Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, height: 50 }}>
      <Ionicons name={icon} size={17} color="#9CA3AF" style={{ marginRight: 10 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
        style={{ flex: 1, fontSize: 15, color: '#111827' }}
      />
    </View>
  </View>
);

const Profile = () => {
  const router = useRouter();
  const { backendUser, updateBackendUser } = useBackendAuth();
  const keyboardInset = useKeyboardInset();
  const [isLegalExpanded, setIsLegalExpanded] = useState(false);

  // Edit name (inline pencil)
  const [showEditName, setShowEditName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', phone: '', location: '', age: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const displayName =
    backendUser?.username ||
    backendUser?.fullname ||
    backendUser?.name ||
    'User';
  const profilePic = backendUser?.profilePicture;

  const openEditName = () => {
    setNameInput(displayName);
    setShowEditName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return Alert.alert('Error', 'Name cannot be empty');
    if (trimmed === displayName) { setShowEditName(false); return; }
    setSavingName(true);
    try {
      await updateProfileAPI({ username: trimmed, fullname: trimmed });
      await updateBackendUser({ ...backendUser, username: trimmed, fullname: trimmed, name: trimmed });
      setShowEditName(false);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const openEditProfile = () => {
    setProfileForm({
      username: backendUser?.username || backendUser?.name || '',
      phone: backendUser?.phone || '',
      location: backendUser?.location || '',
      age: backendUser?.age ? String(backendUser.age) : '',
    });
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const trimmedUsername = profileForm.username.trim();
      const payload = {
        username: trimmedUsername || undefined,
        fullname: trimmedUsername || undefined,
        phone: profileForm.phone.trim() || undefined,
        location: profileForm.location.trim() || undefined,
        age: profileForm.age ? parseInt(profileForm.age, 10) : undefined,
      };
      await updateProfileAPI(payload);
      await updateBackendUser({ ...backendUser, ...payload });
      setShowEditProfile(false);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-200 pt-10">
      <View className="p-5 flex-1">

        {/* Profile Section */}
        <View className="mt-10 items-center">
          <Image
            source={profilePic ? { uri: profilePic } : require('../assets/images/default_profile.webp')}
            className="h-[200px] w-[200px] rounded-full"
          />

          {/* Name row with edit pencil */}
          <View className="flex-row items-center gap-2 mt-4">
            <Text className="text-2xl font-bold text-black">{displayName}</Text>
            <TouchableOpacity onPress={openEditName} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="pencil" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={openEditProfile} className="mt-1">
            <Text className="text-gray-500 underline">Edit your profile</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View className="mt-10 w-full gap-2">
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/help-center', params: { backTo: BACK_TO_PROFILE } })}
            className="flex-row items-center justify-between bg-white p-3 rounded-xl shadow-sm"
          >
            <View className="flex-row items-center gap-4">
              <MaterialIcons name="help-center" size={40} color="#FBBF24" />
              <Text className="font-semibold text-black">Help Center</Text>
            </View>
            <Icon name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/customer-support', params: { backTo: BACK_TO_PROFILE } })}
            className="flex-row items-center justify-between bg-white p-3 rounded-xl shadow-sm"
          >
            <View className="flex-row items-center gap-4">
              <MaterialIcons name="support-agent" size={35} color="#60A5FA" />
              <View>
                <Text className="font-semibold text-black">Contact Support</Text>
                <Text className="text-gray-400 text-xs">Chat with our team</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View>
            <TouchableOpacity
              onPress={() => setIsLegalExpanded(!isLegalExpanded)}
              className="flex-row items-center justify-between bg-white p-3 rounded-xl shadow-sm"
            >
              <View className="flex-row items-center gap-4">
                <MaterialIcons name="description" size={35} color="#60A5FA" />
                <Text className="font-semibold text-black">Legal</Text>
              </View>
              <Icon name={isLegalExpanded ? 'chevron-up' : 'chevron-right'} size={16} color="#9CA3AF" />
            </TouchableOpacity>
            {isLegalExpanded && (
              <View className="mt-2 ml-12 bg-white rounded-xl overflow-hidden shadow-sm">
                <TouchableOpacity onPress={() => router.push({ pathname: '/data-protection', params: { backTo: BACK_TO_PROFILE } })} className="p-3 border-b border-gray-100">
                  <Text className="text-gray-700">Privacy Policy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push({ pathname: '/terms-of-use', params: { backTo: BACK_TO_PROFILE } })} className="p-3">
                  <Text className="text-gray-700">Terms of Use</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/delete-account', params: { backTo: BACK_TO_PROFILE } })}
            className="bg-red-500 p-3 rounded-xl shadow-sm mt-4"
          >
            <Text className="text-white text-center font-semibold">Delete Account</Text>
          </TouchableOpacity>

          <TouchableOpacity className="bg-green-500 p-3 rounded-xl shadow-sm mt-2">
            <Text className="text-white text-center font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Edit Name Modal */}
      <Modal visible={showEditName} transparent animationType="fade" onRequestClose={() => setShowEditName(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>Change Name</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, height: 50, marginBottom: 20 }}>
              <Ionicons name="person-outline" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, fontSize: 15, color: '#111827' }}
                autoFocus
                maxLength={40}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowEditName(false)} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#374151' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', opacity: savingName ? 0.6 : 1 }}>
                {savingName ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontWeight: '800', color: '#fff' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, maxHeight: '90%' }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827' }}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setShowEditProfile(false)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: keyboardInset > 0 ? keyboardInset + 32 : 16 }}
              >
                <Field
                  icon="person-outline"
                  label="Username"
                  value={profileForm.username}
                  onChangeText={(v) => setProfileForm({ ...profileForm, username: v })}
                  placeholder="Your display name"
                />
                <Field
                  icon="call-outline"
                  label="Phone"
                  value={profileForm.phone}
                  onChangeText={(v) => setProfileForm({ ...profileForm, phone: v })}
                  placeholder="e.g. +1 555 000 0000"
                  keyboardType="phone-pad"
                />
                <Field
                  icon="location-outline"
                  label="Location"
                  value={profileForm.location}
                  onChangeText={(v) => setProfileForm({ ...profileForm, location: v })}
                  placeholder="City, Country"
                />
                <Field
                  icon="calendar-outline"
                  label="Age"
                  value={profileForm.age}
                  onChangeText={(v) => setProfileForm({ ...profileForm, age: v.replace(/[^0-9]/g, '') })}
                  placeholder="Your age"
                  keyboardType="number-pad"
                />

                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  style={{ backgroundColor: '#111827', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8, opacity: savingProfile ? 0.6 : 1 }}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

export default Profile;
