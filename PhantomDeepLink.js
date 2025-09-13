import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  TextInput,
} from 'react-native';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function PhantomDeepLink() {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState(null);
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState('Hello Phantom!');

  // Deep link listener
  useEffect(() => {
    const handleDeepLink = (url) => {
      console.log('Deep link received:', url);
      handlePhantomResponse(url);
    };

    // Add listener for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Parse Phantom response from deep link
  const handlePhantomResponse = (url) => {
    try {
      const urlParams = new URL(url).searchParams;
      const data = urlParams.get('data');
      
      if (data) {
        const response = JSON.parse(decodeURIComponent(data));
        console.log('Phantom response:', response);

        if (response.public_key) {
          setPhantomWalletPublicKey(response.public_key);
          setSession(response.session);
          Alert.alert('연결 성공!', `공개키: ${response.public_key.slice(0, 20)}...`);
        }

        if (response.signature) {
          Alert.alert('서명 성공!', `서명: ${response.signature.slice(0, 20)}...`);
        }

        if (response.transaction) {
          Alert.alert('트랜잭션 성공!', `트랜잭션: ${response.transaction.slice(0, 20)}...`);
        }
      }
    } catch (error) {
      console.error('Error parsing Phantom response:', error);
      Alert.alert('오류', `응답 파싱 실패: ${error.message}`);
    }
  };

  // Connect to Phantom wallet
  const connectPhantom = () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: generateEncryptionKey(),
      cluster: 'devnet', // or 'mainnet-beta'
      app_url: 'https://phantom.app',
      redirect_link: 'phantomtestapp://phantom-response'
    });

    const phantomUrl = `phantom://v1/connect?${params.toString()}`;
    
    Linking.canOpenURL(phantomUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(phantomUrl);
        } else {
          Alert.alert('Phantom 앱 없음', 'Phantom 지갑 앱을 먼저 설치해주세요.');
        }
      })
      .catch(err => {
        console.error('Deep link error:', err);
        Alert.alert('오류', 'Phantom 연결에 실패했습니다.');
      });
  };

  // Sign message with Phantom
  const signMessage = () => {
    if (!phantomWalletPublicKey || !session) {
      Alert.alert('오류', '먼저 Phantom 지갑을 연결해주세요.');
      return;
    }

    const encodedMessage = bs58.encode(Buffer.from(message, 'utf8'));
    
    const params = new URLSearchParams({
      dapp_encryption_public_key: session.dapp_encryption_public_key,
      nonce: session.nonce,
      message: encodedMessage,
      redirect_link: 'phantomtestapp://phantom-response'
    });

    const phantomUrl = `phantom://v1/signMessage?${params.toString()}`;
    
    Linking.openURL(phantomUrl)
      .catch(err => {
        console.error('Sign message error:', err);
        Alert.alert('오류', '메시지 서명에 실패했습니다.');
      });
  };

  // Send SOL transaction (example)
  const sendTransaction = () => {
    if (!phantomWalletPublicKey || !session) {
      Alert.alert('오류', '먼저 Phantom 지갑을 연결해주세요.');
      return;
    }

    // This is a simplified example - you'd need to create a proper Solana transaction
    const transactionData = {
      transaction: 'base58-encoded-transaction',
      message: 'Transfer 0.001 SOL'
    };

    const params = new URLSearchParams({
      dapp_encryption_public_key: session.dapp_encryption_public_key,
      nonce: session.nonce,
      transaction: transactionData.transaction,
      redirect_link: 'phantomtestapp://phantom-response'
    });

    const phantomUrl = `phantom://v1/signAndSendTransaction?${params.toString()}`;
    
    Linking.openURL(phantomUrl)
      .catch(err => {
        console.error('Transaction error:', err);
        Alert.alert('오류', '트랜잭션 전송에 실패했습니다.');
      });
  };

  // Disconnect from Phantom
  const disconnectPhantom = () => {
    if (!session) {
      Alert.alert('오류', '연결된 세션이 없습니다.');
      return;
    }

    const params = new URLSearchParams({
      dapp_encryption_public_key: session.dapp_encryption_public_key,
      nonce: session.nonce,
      redirect_link: 'phantomtestapp://phantom-response'
    });

    const phantomUrl = `phantom://v1/disconnect?${params.toString()}`;
    
    Linking.openURL(phantomUrl)
      .then(() => {
        setPhantomWalletPublicKey(null);
        setSession(null);
      })
      .catch(err => {
        console.error('Disconnect error:', err);
        Alert.alert('오류', '연결 해제에 실패했습니다.');
      });
  };

  // Generate encryption key for secure communication
  const generateEncryptionKey = () => {
    const keypair = nacl.box.keyPair();
    return bs58.encode(keypair.publicKey);
  };

  if (!phantomWalletPublicKey) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Phantom 지갑 Deep Link 연결</Text>
        <Text style={styles.subtitle}>기존 Phantom 앱과 직접 연결</Text>
        
        <TouchableOpacity style={styles.button} onPress={connectPhantom}>
          <Text style={styles.buttonText}>Phantom 지갑 연결</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>필수 조건:</Text>
          <Text style={styles.infoText}>• Phantom 지갑 앱 설치 필요</Text>
          <Text style={styles.infoText}>• app.json에 scheme 설정 필요</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Phantom 지갑 연결됨</Text>
      
      <View style={styles.addressContainer}>
        <Text style={styles.addressLabel}>공개키:</Text>
        <Text style={styles.address}>
          {phantomWalletPublicKey.slice(0, 20)}...{phantomWalletPublicKey.slice(-10)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>메시지 서명</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="서명할 메시지 입력"
          multiline
        />
        <TouchableOpacity style={styles.button} onPress={signMessage}>
          <Text style={styles.buttonText}>메시지 서명</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>트랜잭션</Text>
        <TouchableOpacity style={styles.button} onPress={sendTransaction}>
          <Text style={styles.buttonText}>SOL 전송 (예시)</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.disconnectButton]} 
        onPress={disconnectPhantom}
      >
        <Text style={styles.buttonText}>연결 해제</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  addressContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  address: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#ab9ff2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: '#ff6b6b',
    marginTop: 20,
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});