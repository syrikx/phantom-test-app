import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  useConnect,
  useAccounts,
  useDisconnect,
  useSignMessage,
  useSignAndSendTransaction,
} from '@phantom/react-native-sdk';

export default function WalletScreen() {
  const { connect, isConnecting } = useConnect();
  const { addresses, isConnected } = useAccounts();
  const { disconnect } = useDisconnect();
  const { signMessage } = useSignMessage();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  
  const [message, setMessage] = useState('Hello Phantom!');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('0.001');

  const handleConnect = async () => {
    try {
      await connect({ provider: 'google' });
      Alert.alert('성공', '지갑이 연결되었습니다!');
    } catch (error) {
      Alert.alert('오류', `연결 실패: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      Alert.alert('성공', '지갑 연결이 해제되었습니다!');
    } catch (error) {
      Alert.alert('오류', `연결 해제 실패: ${error.message}`);
    }
  };

  const handleSignMessage = async () => {
    if (!message.trim()) {
      Alert.alert('오류', '메시지를 입력해주세요.');
      return;
    }

    try {
      const signature = await signMessage(message);
      Alert.alert('서명 성공', `서명: ${signature.slice(0, 20)}...`);
    } catch (error) {
      Alert.alert('오류', `메시지 서명 실패: ${error.message}`);
    }
  };

  const handleSendTransaction = async () => {
    if (!recipient.trim() || !amount.trim()) {
      Alert.alert('오류', '받는 주소와 금액을 입력해주세요.');
      return;
    }

    try {
      const transaction = {
        type: 'transfer',
        params: {
          destination: recipient,
          amount: parseFloat(amount) * 1000000000, // Convert to lamports
        },
      };

      const signature = await signAndSendTransaction(transaction);
      Alert.alert('전송 성공', `트랜잭션 서명: ${signature.slice(0, 20)}...`);
    } catch (error) {
      Alert.alert('오류', `트랜잭션 전송 실패: ${error.message}`);
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Phantom 지갑 테스트 앱</Text>
        <Text style={styles.subtitle}>지갑을 연결하여 시작하세요</Text>
        
        <TouchableOpacity
          style={[styles.button, isConnecting && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          <Text style={styles.buttonText}>
            {isConnecting ? '연결 중...' : 'Google로 지갑 연결'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Phantom 지갑 연결됨</Text>
      
      <View style={styles.addressContainer}>
        <Text style={styles.addressLabel}>지갑 주소:</Text>
        {addresses.map((address, index) => (
          <Text key={index} style={styles.address}>
            {address.slice(0, 20)}...{address.slice(-10)}
          </Text>
        ))}
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
        <TouchableOpacity style={styles.button} onPress={handleSignMessage}>
          <Text style={styles.buttonText}>메시지 서명</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SOL 전송 (테스트용)</Text>
        <TextInput
          style={styles.input}
          value={recipient}
          onChangeText={setRecipient}
          placeholder="받는 주소 입력"
        />
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="전송할 SOL 수량"
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.button} onPress={handleSendTransaction}>
          <Text style={styles.buttonText}>트랜잭션 전송</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.disconnectButton]} 
        onPress={handleDisconnect}
      >
        <Text style={styles.buttonText}>지갑 연결 해제</Text>
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
  buttonDisabled: {
    opacity: 0.6,
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
});