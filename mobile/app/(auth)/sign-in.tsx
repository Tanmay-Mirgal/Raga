import { useClerk, useOAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { authStyles } from '../../theme/authStyles';
import { Link, useRouter } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, Alert, Image, ActivityIndicator, StatusBar } from 'react-native';
import React, { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { client, setActive, loaded } = useClerk();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

  const onGoogleSignInPress = React.useCallback(async () => {
    try {
      setGoogleLoading(true);
      // Uses the scheme from app.json ("raga"); a hard-coded "mobile" scheme no longer matches the app.
      const redirectUrl = Linking.createURL('/');
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow({
        redirectUrl,
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      console.error('OAuth error', err);
      Alert.alert('OAuth Error', err.message || 'Google Authentication failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [startOAuthFlow, router]);

  const onSignInPress = React.useCallback(async () => {
    if (!loaded) return;
    setLoading(true);

    try {
      const signInAttempt = await client.signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/');
      } else {
        Alert.alert('Sign In Info', 'Authentication requires additional steps.');
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      Alert.alert('Error', err.errors?.[0]?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }, [loaded, emailAddress, password, router, setActive, client]);

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
        <Text style={styles.subtitle}>Soundscape, unlocked.</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.inputLabel}>Email or Username</Text>
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
          placeholder="Enter your password..."
          placeholderTextColor="#6B6B78"
          secureTextEntry={true}
          onChangeText={(val) => setPassword(val)}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          style={[styles.input, passwordFocused && styles.inputFocused]}
        />
        
        <TouchableOpacity 
          style={styles.signInButton} 
          onPress={onSignInPress}
          disabled={loading || googleLoading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.signInButtonText}>Log In</Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          style={styles.googleButton} 
          onPress={onGoogleSignInPress}
          disabled={loading || googleLoading}
          activeOpacity={0.8}
        >
          {googleLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={styles.googleButtonContent}>
              <Ionicons name="logo-google" size={18} color="#FFFFFF" style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Raga?</Text>
        <Link href="/sign-up" asChild>
          <TouchableOpacity>
            <Text style={styles.link}>Create account</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = authStyles;
