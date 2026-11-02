import { useClerk } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { authStyles } from '../../theme/authStyles';
import { Link, useRouter } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, Alert, Image, ActivityIndicator, StatusBar } from 'react-native';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function SignUpScreen() {
  const { client, setActive, loaded } = useClerk();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  const onSignUpPress = async () => {
    if (!loaded) return;
    setLoading(true);

    try {
      await client.signUp.create({
        emailAddress,
        password,
      });

      await client.signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setPendingVerification(true);
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      Alert.alert('Error', err.errors?.[0]?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPress = async () => {
    if (!loaded) return;
    setLoading(true);

    try {
      const signUpAttempt = await client.signUp.attemptEmailAddressVerification({
        code,
      });

      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
        router.replace('/');
      } else {
        Alert.alert('Verification Alert', 'Verification incomplete.');
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      Alert.alert('Error', err.errors?.[0]?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['rgba(29,185,84,0.22)', 'rgba(10,10,15,0)']} style={styles.glow} pointerEvents="none" />
      
      <View style={styles.headerContainer}>
        <View style={styles.logoWrapper}>
          <Image 
            source={require('../../assets/images/riffy_logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Raga</Text>
        <Text style={styles.subtitle}>Sign up to start listening.</Text>
      </View>

      {!pendingVerification ? (
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email address</Text>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Enter your email..."
            placeholderTextColor="#6B6B78"
            onChangeText={(val) => setEmailAddress(val)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            style={[styles.input, emailFocused && styles.inputFocused]}
          />
          
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            value={password}
            placeholder="Create a password..."
            placeholderTextColor="#6B6B78"
            secureTextEntry={true}
            onChangeText={(val) => setPassword(val)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            style={[styles.input, passwordFocused && styles.inputFocused]}
          />
          
          <TouchableOpacity 
            style={styles.signUpButton} 
            onPress={onSignUpPress}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Verification Code</Text>
          <Text style={styles.helperText}>We've sent a 6-digit code to {emailAddress}</Text>
          <TextInput
            value={code}
            placeholder="Enter verification code..."
            placeholderTextColor="#6B6B78"
            onChangeText={(val) => setCode(val)}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            style={[styles.input, codeFocused && styles.inputFocused]}
            keyboardType="number-pad"
          />
          
          <TouchableOpacity 
            style={styles.signUpButton} 
            onPress={onVerifyPress}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.signUpButtonText}>Verify Account</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/sign-in" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>Log in</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = authStyles;
