import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraIcon } from '@solar-icons/react-native/bold/camera';
import { CloseCircleIcon } from '@solar-icons/react-native/bold/close-circle';
import { UserRoundedIcon } from '@solar-icons/react-native/bold/user-rounded';
import { MagnifierIcon } from '@solar-icons/react-native/bold/magnifier';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { NotificationType, triggerNotification } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import type { Friend } from '../../types';
import { MEMBER_DIRECTORY } from '../../data/memberDirectory';
import { availableUsername, buildMemberDirectory, normalizeUsername, searchMembers, type DirectoryMember } from '../../utils/memberProfiles';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassPill } from '../glass/GlassPill';
import { ScrollEdgeFade } from '../common/ScrollEdgeFade';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { ModalPage } from '../common/ModalPage';
import { SheetModal } from '../common/SheetModal';
import { BottomBubble, type BubbleNotice } from '../common/BottomBubble';

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  tripId?: string;
  editingFriend?: Friend | null;
}

const WEB_INPUT_RESET = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', boxShadow: 'none' } as unknown as ViewStyle)
  : undefined;

export function AddMemberModal({ visible, onClose, tripId, editingFriend }: AddMemberModalProps) {
  return (
    <SheetModal visible={visible} statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <ModalBackdrop onClose={onClose} />
      <ModalPage>
        {visible ? (
          <MemberPageContent key={editingFriend?.id ?? tripId ?? 'new-member'} editingFriend={editingFriend} tripId={tripId} onClose={onClose} />
        ) : null}
      </ModalPage>
    </SheetModal>
  );
}

function MemberPageContent({ editingFriend, tripId, onClose }: Omit<AddMemberModalProps, 'visible'>) {
  const { friends, trips, addFriend, updateFriend, addMemberToTrip } = useSplitTrack();
  const { themeMode } = useLiquidGlass();
  const insets = useSafeAreaInsets();
  const isDark = themeMode === 'dark';
  const isEditing = Boolean(editingFriend);
  const [query, setQuery] = useState('');
  const [name, setName] = useState(editingFriend?.name ?? '');
  const [handle, setHandle] = useState(editingFriend?.handle ?? '');
  const [upiId, setUpiId] = useState(editingFriend?.upiId ?? '');
  const [phone, setPhone] = useState(editingFriend?.phone ?? '');
  const [photoUri, setPhotoUri] = useState(editingFriend?.avatar ?? '');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<BubbleNotice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const adding = useRef(new Set<string>());

  const bg = isDark ? '#09090B' : '#F4F4F8';
  const surface = isDark ? '#1C1C22' : '#EFEFF4';
  const textColor = isDark ? '#F4F4F5' : '#18181B';
  const mutedText = isDark ? '#A1A1AA' : '#71717A';
  const accent = isDark ? '#34D399' : '#047857';
  const directory = useMemo(() => buildMemberDirectory(friends, MEMBER_DIRECTORY), [friends]);
  const results = useMemo(() => searchMembers(directory, query), [directory, query]);
  const trip = tripId ? trips.find((item) => item.id === tripId) : undefined;
  const addedHandles = useMemo(() => new Set(
    friends.filter((friend) => !tripId || trip?.members.includes(friend.id)).map((friend) => normalizeUsername(friend.handle))
  ), [friends, trip, tripId]);

  const addProfile = (profile: DirectoryMember) => {
    const username = normalizeUsername(profile.handle);
    if (addedHandles.has(username) || adding.current.has(username)) return;
    adding.current.add(username);
    const member = tripId
      ? addMemberToTrip(tripId, profile.friendId ?? profile)
      : addFriend(profile);
    if (member) {
      setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, message: `${member.name} added${tripId ? ' to the trip' : ''}` }));
      setError('');
      if (!tripId) triggerNotification(NotificationType.Success);
    } else {
      setError('This trip is no longer available. Reopen it to add members.');
    }
    adding.current.delete(username);
  };

  const pickPhoto = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Allow photo library access to choose a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        base64: Platform.OS === 'web',
      });
      const asset = !result.canceled ? result.assets[0] : undefined;
      if (asset) {
        setPhotoUri(asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri);
        setError('');
      }
    } catch {
      setError('The photo could not be opened. Please try again.');
    } finally {
      setPicking(false);
    }
  };

  const saveDetails = () => {
    const cleanName = name.trim();
    if (!cleanName) { setError('Enter a full name.'); return; }
    const username = normalizeUsername(handle);
    if (username && !/^[a-z0-9._]+$/.test(username)) {
      setError('Use letters, numbers, dots, or underscores in the username.');
      return;
    }
    const collision = username ? directory.find((profile) =>
      normalizeUsername(profile.handle) === username && (!editingFriend || profile.friendId !== editingFriend.id)
    ) : undefined;
    if (collision) {
      setError(`That username belongs to ${collision.name}. ${isEditing ? 'Choose a different username.' : 'Add their profile from search.'}`);
      return;
    }
    const details = {
      name: cleanName, handle: username ? `@${username}` : availableUsername(cleanName, directory),
      avatar: photoUri, upiId: upiId.trim() || undefined, phone: phone.trim() || undefined,
    };
    if (!editingFriend) return;
    const member = updateFriend(editingFriend.id, details);
    if (!member) { setError('The member could not be saved. Check the username and try again.'); return; }
    onClose();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.page, { backgroundColor: bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <View pointerEvents="none" style={[styles.handle, { top: insets.top + 8, backgroundColor: mutedText }]} />
        <View style={styles.headerRow}>
          <View style={styles.headerButton} />
          <Text style={[styles.title, { color: textColor }]}>{isEditing ? 'Edit Member' : 'Add Members'}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close member page" style={styles.headerButton}>
            <CloseCircleIcon size={24} color={textColor} />
          </TouchableOpacity>
        </View>
        {!isEditing ? (
          <View style={[styles.searchBar, { backgroundColor: surface }]}>
            <MagnifierIcon size={21} color={mutedText} />
            <TextInput
              accessibilityLabel="Search members by name or username" placeholder="Search names or @usernames"
              placeholderTextColor={mutedText} value={query} onChangeText={setQuery}
              autoCapitalize="none" autoCorrect={false} returnKeyType="search"
              style={[styles.searchInput, { color: textColor }, WEB_INPUT_RESET]}
            />
            {query ? <TouchableOpacity accessibilityLabel="Clear member search" onPress={() => setQuery('')} style={styles.clearButton}><CloseCircleIcon size={20} color={mutedText} /></TouchableOpacity> : null}
          </View>
        ) : <Text style={[styles.subtitle, { color: mutedText }]}>Update their photo and payment details</Text>}
      </View>

      {!isEditing ? (
          <ScrollEdgeFade tint={bg} top={12} bottom={24}>
            <FlatList
              data={results} keyExtractor={(profile) => profile.handle} extraData={addedHandles}
              initialNumToRender={10} windowSize={5} showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.resultsContent, { paddingBottom: Math.max(28, insets.bottom + 16) }]}
              renderItem={({ item }) => {
                const added = addedHandles.has(normalizeUsername(item.handle));
                return (
                  <View style={styles.personRow}>
                    {item.avatar ? <Image source={{ uri: item.avatar }} style={styles.personAvatar} /> : <View style={[styles.personAvatar, styles.avatarFallback, { backgroundColor: surface }]}><UserRoundedIcon size={26} color={mutedText} /></View>}
                    <View style={styles.personInfo}>
                      <Text numberOfLines={1} style={[styles.personName, { color: textColor }]}>{item.name}</Text>
                      <Text numberOfLines={1} style={[styles.personHandle, { color: mutedText }]}>{item.handle}</Text>
                    </View>
                    <AnimatedPressable disabled={added} onPress={() => addProfile(item)} accessibilityLabel={`${added ? 'Added' : 'Add'} ${item.name} ${item.handle}`} contentStyle={[styles.addButton, { backgroundColor: surface }]}>
                      {added ? <CheckCircleIcon size={15} color="#10B981" /> : null}
                      <Text style={[styles.addButtonText, { color: textColor }]}>{added ? 'Added' : 'Add'}</Text>
                    </AnimatedPressable>
                  </View>
                );
              }}
              ListEmptyComponent={<View style={styles.empty}><UserRoundedIcon size={38} color={mutedText} /><Text style={[styles.emptyTitle, { color: textColor }]}>No members found</Text><Text style={[styles.emptyText, { color: mutedText }]}>Try another name or @username.</Text></View>}
            />
          </ScrollEdgeFade>
      ) : (
        <ScrollEdgeFade tint={bg}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.formContent}>
            <AnimatedPressable disabled={picking} onPress={pickPhoto} accessibilityLabel="Upload member photo" contentStyle={[styles.photoPicker, { backgroundColor: surface }]}>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : <UserRoundedIcon size={40} color={mutedText} />}
              <View style={[styles.cameraBadge, { backgroundColor: accent }]}><CameraIcon size={15} color="#FFFFFF" /></View>
            </AnimatedPressable>
            <View style={styles.photoActions}>
              <TouchableOpacity onPress={pickPhoto}><Text style={{ color: mutedText }}>{picking ? 'Opening photos…' : photoUri ? 'Change photo' : 'Upload photo'}</Text></TouchableOpacity>
              {photoUri ? <TouchableOpacity onPress={() => setPhotoUri('')}><Text style={{ color: mutedText }}>Remove</Text></TouchableOpacity> : null}
            </View>
            <Text style={[styles.fieldLabel, { color: mutedText }]}>FULL NAME</Text>
            <TextInput accessibilityLabel="Member full name" placeholder="e.g. Aditya Roy" placeholderTextColor={mutedText} value={name} onChangeText={setName} style={[styles.input, { backgroundColor: surface, color: textColor }, WEB_INPUT_RESET]} />
            <Text style={[styles.fieldLabel, { color: mutedText }]}>USERNAME</Text>
            <TextInput accessibilityLabel="Member username" placeholder="@username" placeholderTextColor={mutedText} value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} style={[styles.input, { backgroundColor: surface, color: textColor }, WEB_INPUT_RESET]} />
            <Text style={[styles.fieldLabel, { color: mutedText }]}>UPI ID (OPTIONAL)</Text>
            <TextInput accessibilityLabel="Member UPI ID" placeholder="name@okaxis" placeholderTextColor={mutedText} value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} style={[styles.input, { backgroundColor: surface, color: textColor }, WEB_INPUT_RESET]} />
            <Text style={[styles.fieldLabel, { color: mutedText }]}>PHONE (OPTIONAL)</Text>
            <TextInput accessibilityLabel="Member phone" placeholder="+91 98765 43210" placeholderTextColor={mutedText} value={phone} onChangeText={setPhone} keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={saveDetails} style={[styles.input, { backgroundColor: surface, color: textColor }, WEB_INPUT_RESET]} />
          </ScrollView>
        </ScrollEdgeFade>
      )}

      {isEditing || error ? (
        <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          {isEditing ? <GlassPill label="Save Changes" variant="accent" size="lg" onPress={saveDetails} /> : null}
        </View>
      ) : null}
      <BottomBubble notice={notice} onDismiss={dismissNotice} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  handle: { position: 'absolute', width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '600', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingLeft: 14, minHeight: 50 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 14, paddingHorizontal: 10 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  resultsContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, flexGrow: 1 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 82 },
  personAvatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  personInfo: { flex: 1, minWidth: 0, gap: 4 },
  personName: { fontSize: 15, fontWeight: '600' },
  personHandle: { fontSize: 13 },
  addButton: { minWidth: 78, minHeight: 44, borderRadius: 12, borderWidth: 0, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  addButtonText: { fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  formContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  photoPicker: { width: 92, height: 92, borderRadius: 46, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  photo: { width: 92, height: 92, borderRadius: 46 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 18 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: '500', marginTop: 14, marginBottom: 8 },
  input: { minHeight: 52, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  error: { color: '#F87171', fontSize: 13, lineHeight: 19, marginBottom: 12 },
});
