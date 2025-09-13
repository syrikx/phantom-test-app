import 'react-native-get-random-values';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { PhantomProvider, AddressType } from '@phantom/react-native-sdk';
import WalletScreen from './WalletScreen';
import PhantomDeepLinkOfficial from './PhantomDeepLinkOfficial';

const testConfig = {
  organizationId: "test-org",
  scheme: "testapp",
  embeddedWalletType: "app-wallet",
  addressTypes: [AddressType.solana],
  apiBaseUrl: "https://api.phantom.app/v1/wallets",
};

export default function App() {
  const [useDeepLink, setUseDeepLink] = useState(false);

  if (useDeepLink) {
    return (
      <View style={styles.container}>
        <PhantomDeepLinkOfficial />
        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => setUseDeepLink(false)}
        >
          <Text style={styles.switchText}>SDK 방식으로 전환</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <PhantomProvider config={testConfig}>
      <View style={styles.container}>
        <WalletScreen />
        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => setUseDeepLink(true)}
        >
          <Text style={styles.switchText}>Deep Link 방식으로 전환</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    </PhantomProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
  },
  switchText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
